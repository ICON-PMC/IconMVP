"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FeedCard, cardRatio } from "@/components/feed-card";
import type { FeedItem } from "@/lib/feed";

type SavedIds = { posts: Set<string>; garments: Set<string> };
type LikedIds = { posts: Set<string>; garments: Set<string> };

function itemKey(item: FeedItem) {
  return `${item.kind}:${item.id}`;
}

// Columnas reales (no CSS `columns`): el multicolumn de iOS Safari a veces no pinta el
// contenido de una tarjeta con backdrop-filter. Cada ítem va a la columna más corta
// según su proporción; es estable al añadir ítems al final (scroll infinito).
function subscribeCols(cb: () => void) {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useColumnCount() {
  return useSyncExternalStore(
    subscribeCols,
    () => (window.matchMedia("(min-width: 768px)").matches ? 3 : 2),
    () => 2,
  );
}

function splitColumns(items: FeedItem[], count: number): FeedItem[][] {
  const cols: FeedItem[][] = Array.from({ length: count }, () => []);
  const heights = new Array(count).fill(0);
  for (const it of items) {
    const ratio = cardRatio(it);
    let target = 0;
    for (let i = 1; i < count; i++) if (heights[i] < heights[target]) target = i;
    cols[target].push(it);
    heights[target] += ratio + 0.2; // + alto aproximado del título
  }
  return cols;
}

const BATCH = 24;

// Grilla masonry con scroll infinito. Recibe la primera tanda ya renderizada en el servidor y pide
// el resto de una de dos formas:
//  - feed: a /api/feed con los mismos filtros/orden y `offset`;
//  - búsqueda (`pendingIds`): el servidor ya ordenó todos los resultados y aquí se piden sus filas
//    completas por tandas de 24 a /api/feed/items (spec 006: la página no manda el catálogo entero).
// Se remonta (key derivada de los searchParams, puesta por quien la usa) al cambiar filtros.
export function FeedGrid({
  initialItems,
  initialNextOffset,
  pendingIds,
  initialSaved,
  initialLiked,
  isLoggedIn,
  tagNames,
  emptyState,
}: {
  initialItems: FeedItem[];
  initialNextOffset?: number | null;
  /** Ids ya ordenados que faltan por mostrar (modo búsqueda). */
  pendingIds?: string[];
  initialSaved: SavedIds;
  initialLiked: LikedIds;
  isLoggedIn: boolean;
  tagNames: Record<string, string>;
  /** Contenido cuando no hay resultados (por defecto, el aviso del feed). */
  emptyState?: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState<number | null>(
    pendingIds ? (pendingIds.length ? 0 : null) : (initialNextOffset ?? null),
  );
  const [saved, setSaved] = useState(initialSaved);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const colCount = useColumnCount();
  const columns = useMemo(() => splitColumns(items, colCount), [items, colCount]);

  const loadMore = useCallback(async () => {
    if (loading || nextOffset == null) return;
    setLoading(true);
    setError(null);
    try {
      let url: string;
      let following: number | null;
      if (pendingIds) {
        const ids = pendingIds.slice(nextOffset, nextOffset + BATCH);
        url = `/api/feed/items?ids=${ids.join(",")}`;
        following = nextOffset + BATCH < pendingIds.length ? nextOffset + BATCH : null;
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.set("offset", String(nextOffset));
        url = `/api/feed?${params}`;
        following = null;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("request-failed");
      const data = await res.json();
      setItems((prev) => {
        const seen = new Set(prev.map(itemKey));
        const fresh = (data.items as FeedItem[]).filter((it) => !seen.has(itemKey(it)));
        return [...prev, ...fresh];
      });
      setSaved((prev) => ({
        posts: new Set([...prev.posts, ...((data.savedPosts as string[]) ?? [])]),
        garments: new Set([...prev.garments, ...((data.savedGarments as string[]) ?? [])]),
      }));
      setLiked((prev) => ({
        posts: new Set([...prev.posts, ...((data.likedPosts as string[]) ?? [])]),
        garments: new Set([...prev.garments, ...((data.likedGarments as string[]) ?? [])]),
      }));
      setNextOffset(pendingIds ? following : (data.nextOffset ?? null));
    } catch {
      setError("No pudimos cargar más contenido. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [loading, nextOffset, searchParams, pendingIds]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || nextOffset == null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextOffset, loadMore]);

  if (items.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <div className="glass rounded-2xl px-6 py-16 text-center">
        <p className="text-sm text-ink/60">
          No hay outfits ni prendas con esos filtros. Prueba quitar alguno.
        </p>
        <Link href="/feed" className="mt-3 inline-block text-sm font-medium text-coral hover:underline">
          Limpiar filtros
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-4">
        {columns.map((col, i) => (
          <div key={i} className="min-w-0 flex-1">
            {col.map((item, row) => (
              <FeedCard
                key={itemKey(item)}
                item={item}
                tagNames={tagNames}
                saved={item.kind === "post" ? saved.posts.has(item.id) : saved.garments.has(item.id)}
                liked={item.kind === "post" ? liked.posts.has(item.id) : liked.garments.has(item.id)}
                isLoggedIn={isLoggedIn}
                path="/feed"
                // Primera fila de cada columna y la segunda en las dos primeras: ~4 fotos visibles al cargar.
                priority={row === 0 || (row === 1 && i < 2)}
              />
            ))}
          </div>
        ))}
      </div>
      {nextOffset != null && (
        <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-8" aria-live="polite">
          <p className="text-sm text-ink/40">{error ?? (loading ? "Cargando más…" : "")}</p>
          {error && (
            <button
              type="button"
              onClick={() => loadMore()}
              className="glass-input min-h-11 rounded-full px-4 text-sm font-medium text-ink/80 hover:bg-white/70"
            >
              Reintentar
            </button>
          )}
        </div>
      )}
      {nextOffset == null && (
        <p className="py-8 text-center text-sm text-ink/40">Eso es todo por ahora.</p>
      )}
    </div>
  );
}
