"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, XIcon } from "lucide-react";
import { FeedCard } from "@/components/feed-card";
import { CameraButton } from "@/components/visual/camera-button";
import { FULL, InlineCrop, type CropRect } from "@/components/visual/inline-crop";
import {
  clearVisualSession,
  loadVisualSession,
  saveVisualSession,
  searchByEmbedding,
  searchByPhoto,
  shrink,
  type VisualItem,
  type VisualSession,
} from "@/lib/visual/client";

const FILTER_PARAMS = ["city", "price", "category", "style", "occasion", "color"];
const noopSubscribe = () => () => {};

/**
 * Resultados de la búsqueda por foto con layout tipo Pinterest (spec 005, US1–US3):
 * a la izquierda la foto con su recorte (se ajusta directo sobre ella y la búsqueda se rehace al
 * soltar) y una X para salir; a la derecha las prendas más parecidas. En móvil, la foto arriba.
 * La búsqueda vive en sessionStorage: recargar o volver desde una ficha no pide subir la foto
 * (FR-009); los filtros de la URL se reenvían con el mismo vector (FR-008).
 */
export function VisualResults({
  tagNames,
  savedGarments,
  likedGarments,
}: {
  tagNames: Record<string, string>;
  savedGarments: string[];
  likedGarments: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [version, setVersion] = useState(0);
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => JSON.stringify(loadVisualSession()),
    () => undefined as string | undefined,
  );
  const session: VisualSession | null | undefined = raw === undefined ? undefined : raw ? JSON.parse(raw) : null;
  const [cropBusy, setCropBusy] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  const filters = new URLSearchParams();
  for (const p of FILTER_PARAMS) {
    const v = searchParams.get(p);
    if (v) filters.set(p, v);
  }
  const query = filters.size ? `?${filters}` : "";
  const hasFilters = filters.size > 0;

  // Re-busca con el vector al cambiar la búsqueda o los filtros; "cargando" = la respuesta
  // guardada es de otra petición (el estado solo se escribe cuando llega la respuesta).
  const embedding = session?.embedding;
  const requestKey = `${version}:${embedding?.slice(0, 4).join(",") ?? ""}|${query}`;
  const [result, setResult] = useState<{ key: string; items: VisualItem[]; below: boolean; error: string | null } | null>(
    null,
  );
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

  async function recrop(rect: CropRect) {
    if (!session) return;
    setCropBusy(true);
    setCropError(null);
    try {
      const crop = await shrink(session.original, rect);
      const res = await searchByPhoto(crop.blob, query);
      saveVisualSession({ ...session, query: crop.dataUrl, embedding: res.embedding, rect });
      setVersion((v) => v + 1);
    } catch (e) {
      setCropError(e instanceof Error ? e.message : "No pudimos buscar con ese recorte.");
    } finally {
      setCropBusy(false);
    }
  }

  function close() {
    clearVisualSession();
    router.push("/feed");
  }

  if (session === undefined) return <Loading />;

  if (!session)
    return (
      <div className="bg-surface-raised border border-line flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
        <p className="text-sm text-ink/60">Toma o sube una foto de una prenda para ver las más parecidas.</p>
        <CameraButton isLoggedIn />
      </div>
    );

  const saved = new Set(savedGarments);
  const liked = new Set(likedGarments);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start">
      {/* Foto buscada + recorte (izquierda / arriba en móvil) */}
      <div className="md:sticky md:top-4">
        <div className="relative mx-auto w-fit max-w-full">
          <InlineCrop src={session.original} rect={session.rect ?? FULL} onCommit={recrop} disabled={cropBusy} />
          <button
            type="button"
            onClick={close}
            aria-label="Quitar la búsqueda por foto"
            className="absolute left-3 top-3 flex size-11 items-center justify-center rounded-2xl bg-cream/90 text-ink shadow-md backdrop-blur hover:bg-white"
          >
            <XIcon className="size-6" />
          </button>
          {cropBusy && (
            <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-cream/90 px-3 py-1.5 text-xs text-ink shadow">
              <Loader2Icon className="size-3.5 animate-spin" /> Buscando esta parte…
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink/55">Arrastra las esquinas para elegir la prenda.</p>
          <CameraButton
            isLoggedIn
            label="Otra foto"
            className="bg-surface-raised border-[1.5px] border-line text-text focus:border-line-strong focus:outline-none flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-surface-sunken"
          />
        </div>
        {cropError && (
          <p className="mt-2 text-sm text-coral" role="alert">
            {cropError}
          </p>
        )}
      </div>

      {/* Coincidencias (derecha / abajo en móvil) */}
      <div>
        {current?.error ? (
          <p className="bg-surface-raised border border-line rounded-2xl px-6 py-14 text-center text-sm text-coral">{current.error}</p>
        ) : !current ? (
          <Loading />
        ) : current.items.length === 0 ? (
          <div className="bg-surface-raised border border-line rounded-2xl px-6 py-14 text-center">
            <p className="text-sm text-ink/60">Ninguna prenda cumple esos filtros.</p>
            {hasFilters && (
              <Link href="/feed?visual=1" className="mt-3 inline-block text-sm font-medium text-coral hover:underline">
                Quitar filtros
              </Link>
            )}
          </div>
        ) : (
          <>
            {current.below && (
              <p className="mb-4 rounded-xl bg-blush/40 px-4 py-2.5 text-sm text-ink/70">
                No encontramos algo muy parecido; esto es lo más cercano.
              </p>
            )}
            <div className="columns-2 gap-4 lg:columns-3">
              {current.items.map((item) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  tagNames={tagNames}
                  saved={saved.has(item.id)}
                  liked={liked.has(item.id)}
                  isLoggedIn
                  path="/feed"
                  from="photo_search"
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <p className="flex items-center justify-center gap-2 py-16 text-sm text-ink/60" role="status">
      <Loader2Icon className="size-4 animate-spin" /> Buscando prendas parecidas…
    </p>
  );
}
