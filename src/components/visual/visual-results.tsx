"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CropIcon, Loader2Icon } from "lucide-react";
import { FeedCard } from "@/components/feed-card";
import { CameraButton } from "@/components/visual/camera-button";
import { CropSheet } from "@/components/visual/crop-sheet";
import {
  loadVisualSession,
  saveVisualSession,
  searchByEmbedding,
  searchByPhoto,
  shrink,
  type VisualItem,
  type VisualSession,
} from "@/lib/visual/client";

const FILTER_PARAMS = ["city", "price", "category", "style", "occasion", "color"];

/**
 * Resultados de la búsqueda por foto (spec 005, US1–US3). Lee la búsqueda de sessionStorage, así
 * que recargar o volver desde una ficha no pide subir la foto otra vez (FR-009); los filtros de la
 * URL se reenvían con el mismo vector (FR-008).
 */
export function VisualResults({
  tagNames,
  savedGarments,
  likedGarments,
  isLoggedIn,
}: {
  tagNames: Record<string, string>;
  savedGarments: string[];
  likedGarments: string[];
  isLoggedIn: boolean;
}) {
  const searchParams = useSearchParams();
  // La búsqueda vive en sessionStorage: se lee como store externo (null en el servidor).
  const [version, setVersion] = useState(0);
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => (typeof window === "undefined" ? null : JSON.stringify(loadVisualSession())),
    () => undefined as string | undefined,
  );
  const session: VisualSession | null | undefined = raw === undefined ? undefined : raw ? JSON.parse(raw) : null;
  const sessionKey = session ? `${version}:${session.embedding.slice(0, 4).join(",")}` : "";
  const [result, setResult] = useState<{
    key: string;
    items: VisualItem[];
    below: boolean;
    error: string | null;
  } | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropBusy, setCropBusy] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  const filters = new URLSearchParams();
  for (const p of FILTER_PARAMS) {
    const v = searchParams.get(p);
    if (v) filters.set(p, v);
  }
  const query = filters.size ? `?${filters}` : "";
  const hasFilters = filters.size > 0;

  // Re-busca con el vector cada vez que cambian la búsqueda o los filtros. El estado solo se
  // escribe al llegar la respuesta; "cargando" = la respuesta guardada es de otra búsqueda.
  const requestKey = `${sessionKey}|${query}`;
  const embedding = session?.embedding;
  useEffect(() => {
    if (!embedding) return;
    let cancelled = false;
    searchByEmbedding(embedding, query)
      .then((r) => !cancelled && setResult({ key: requestKey, items: r.items, below: r.belowThreshold, error: null }))
      .catch(
        (e) =>
          !cancelled &&
          setResult({ key: requestKey, items: [], below: false, error: e instanceof Error ? e.message : String(e) }),
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestKey resume embedding + query
  }, [requestKey]);
  const current = result?.key === requestKey ? result : null;
  const items = current ? current.items : null;
  const below = current?.below ?? false;
  const error = current?.error ?? null;

  async function searchCrop(rect: { x: number; y: number; w: number; h: number }) {
    if (!session) return;
    setCropBusy(true);
    setCropError(null);
    try {
      const crop = await shrink(session.original, rect);
      const res = await searchByPhoto(crop.blob, query);
      const next = { original: session.original, query: crop.dataUrl, embedding: res.embedding };
      saveVisualSession(next);
      setVersion((v) => v + 1);
      setCropOpen(false);
    } catch (e) {
      setCropError(e instanceof Error ? e.message : "No pudimos buscar con ese recorte.");
    } finally {
      setCropBusy(false);
    }
  }

  if (session === undefined) return <Loading />;

  if (!session)
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
        <p className="text-sm text-ink/60">Toma o sube una foto de una prenda para ver las más parecidas.</p>
        <CameraButton />
      </div>
    );

  const saved = new Set(savedGarments);
  const liked = new Set(likedGarments);

  return (
    <div>
      <div className="glass mb-5 flex items-center gap-4 rounded-2xl p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (data URL) */}
        <img src={session.query} alt="Tu foto" className="size-20 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-forest">Buscando por tu foto</p>
          <p className="text-xs text-ink/55">¿Hay varias prendas? Recorta la que quieres.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCropError(null);
            setCropOpen(true);
          }}
          className="glass-input flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-white/70"
        >
          <CropIcon className="size-4" /> Recortar
        </button>
      </div>

      {error ? (
        <p className="glass rounded-2xl px-6 py-14 text-center text-sm text-coral">{error}</p>
      ) : items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl px-6 py-14 text-center">
          <p className="text-sm text-ink/60">Ninguna prenda cumple esos filtros.</p>
          {hasFilters && (
            <Link href="/feed?visual=1" className="mt-3 inline-block text-sm font-medium text-coral hover:underline">
              Quitar filtros
            </Link>
          )}
        </div>
      ) : (
        <>
          {below && (
            <p className="mb-4 rounded-xl bg-blush/40 px-4 py-2.5 text-sm text-ink/70">
              No encontramos algo muy parecido; esto es lo más cercano.
            </p>
          )}
          <div className="columns-2 gap-4 md:columns-3">
            {items.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                tagNames={tagNames}
                saved={saved.has(item.id)}
                liked={liked.has(item.id)}
                isLoggedIn={isLoggedIn}
                path="/feed"
                from="photo_search"
              />
            ))}
          </div>
        </>
      )}

      <CropSheet
        open={cropOpen}
        onOpenChange={setCropOpen}
        src={session.original}
        busy={cropBusy}
        error={cropError}
        onSearch={searchCrop}
      />
    </div>
  );
}

const noopSubscribe = () => () => {};

function Loading() {
  return (
    <p className="flex items-center justify-center gap-2 py-16 text-sm text-ink/60" role="status">
      <Loader2Icon className="size-4 animate-spin" /> Buscando prendas parecidas…
    </p>
  );
}
