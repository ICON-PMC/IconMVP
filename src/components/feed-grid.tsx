"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { SearchXIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { usePathname, useSearchParams } from "next/navigation";
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
// Board: 2 columnas en celular, 3 en tableta y 4 (máximo) desde 1024 px.
const COL_QUERIES = ["(min-width: 1024px)", "(min-width: 768px)"] as const;
function subscribeCols(cb: () => void) {
  const mqs = COL_QUERIES.map((q) => window.matchMedia(q));
  mqs.forEach((mq) => mq.addEventListener("change", cb));
  return () => mqs.forEach((mq) => mq.removeEventListener("change", cb));
}
function useColumnCount() {
  return useSyncExternalStore(
    subscribeCols,
    () => (window.matchMedia(COL_QUERIES[0]).matches ? 4 : window.matchMedia(COL_QUERIES[1]).matches ? 3 : 2),
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
    heights[target] += ratio + 0.15; // + alto aproximado del texto bajo la foto
  }
  return cols;
}

const BATCH = 24;

// ── Volver atrás sin perder el feed (spec 006, US4) ──────────────────────────
// Al volver desde una ficha, Next vuelve a montar la grilla con la primera tanda y se pierden las
// que ya se habían cargado. Se guarda el estado en sessionStorage y se restaura solo cuando el
// montaje viene de un "atrás/adelante" del navegador (popstate) y el estado tiene < 30 minutos.
const STORE_PREFIX = "icon.feed.v1:";
const MAX_AGE_MS = 30 * 60 * 1000;
type Stored = {
  items: FeedItem[];
  nextOffset: number | null;
  scrollY: number;
  saved: { posts: string[]; garments: string[] };
  liked: { posts: string[]; garments: string[] };
  savedAt: number;
};
let lastPopState = 0;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastPopState = Date.now();
  });
}
function readStored(key: string): Stored | null {
  if (typeof window === "undefined" || Date.now() - lastPopState > 2000) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    return Date.now() - s.savedAt < MAX_AGE_MS ? s : null;
  } catch {
    return null;
  }
}
function writeStored(key: string, s: Omit<Stored, "savedAt">) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...s, savedAt: Date.now() }));
  } catch {
    /* sin sessionStorage o lleno: el feed funciona igual, solo no se restaura */
  }
}
function storeKey(pathname: string, search: URLSearchParams) {
  const sorted = [...search.entries()].filter(([k]) => k !== "offset").sort(([a], [b]) => a.localeCompare(b));
  return `${STORE_PREFIX}${pathname}?${new URLSearchParams(sorted)}`;
}

function mergeIds(
  stored: { posts: string[]; garments: string[] },
  fresh: { posts: Set<string>; garments: Set<string> },
  firstPage: FeedItem[],
) {
  const known = new Set(firstPage.map((i) => i.id));
  const pick = (old: string[], now: Set<string>) =>
    new Set([...old.filter((id) => !known.has(id)), ...now]);
  return { posts: pick(stored.posts, fresh.posts), garments: pick(stored.garments, fresh.garments) };
}

// Ahorro de datos activado: no precargar fichas (spec 006, FR-023).
function subscribeNone() {
  return () => {};
}
function useSaveData() {
  return useSyncExternalStore(
    subscribeNone,
    () => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData),
    () => false,
  );
}

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
  apiQuery,
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
  /** Parámetros extra para /api/feed (p. ej. el perfil cuyas pestañas se cargan). */
  apiQuery?: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const key = storeKey(pathname, searchParams);
  // Leído una sola vez al montar: en la carga inicial (con hidratación) no hay popstate reciente,
  // así que el primer render coincide con el del servidor.
  const [restored] = useState(() => readStored(key));
  const [items, setItems] = useState(restored?.items ?? initialItems);
  const [nextOffset, setNextOffset] = useState<number | null>(
    restored
      ? restored.nextOffset
      : pendingIds
        ? pendingIds.length
          ? 0
          : null
        : (initialNextOffset ?? null),
  );
  const saveData = useSaveData();
  const scrollRef = useRef(0);
  // Guardados y likes: para la primera tanda manda lo que acaba de leer el servidor (pudo cambiar en
  // la ficha); para el resto, lo restaurado.
  const [saved, setSaved] = useState<SavedIds>(() =>
    restored ? mergeIds(restored.saved, initialSaved, initialItems) : initialSaved,
  );
  const [liked, setLiked] = useState<LikedIds>(() =>
    restored ? mergeIds(restored.liked, initialLiked, initialItems) : initialLiked,
  );
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
        for (const [k, v] of Object.entries(apiQuery ?? {})) params.set(k, v);
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
  }, [loading, nextOffset, searchParams, pendingIds, apiQuery]);

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

  // Guarda tandas y posición; la posición se toma en cada scroll (barato: solo una variable).
  useEffect(() => {
    const onScroll = () => {
      scrollRef.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const save = () =>
      writeStored(key, {
        items,
        nextOffset,
        scrollY: scrollRef.current,
        saved: { posts: [...saved.posts], garments: [...saved.garments] },
        liked: { posts: [...liked.posts], garments: [...liked.garments] },
      });
    save();
    window.addEventListener("pagehide", save);
    return () => {
      save(); // al desmontar (navegación a una ficha) queda la última posición
      window.removeEventListener("pagehide", save);
    };
  }, [key, items, nextOffset, saved, liked]);
  // Restaurar la posición después de pintar las tarjetas restauradas.
  useEffect(() => {
    if (!restored) return;
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, restored.scrollY)));
  }, [restored]);

  if (items.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <EmptyState
        icon={SearchXIcon}
        title="No hay resultados con esos filtros"
        description="Prueba quitar alguno."
        action={{ label: "Limpiar filtros", href: "/feed" }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-start gap-3 md:gap-4">
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
                prefetch={saveData ? false : undefined}
                // Primera fila de cada columna y la segunda en las dos primeras: ~4 fotos visibles al cargar.
                priority={row === 0 || (row === 1 && i < 2)}
              />
            ))}
          </div>
        ))}
      </div>
      {nextOffset != null && (
        <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-8" aria-live="polite">
          <p className="text-sm text-text-muted">{error ?? (loading ? "Cargando más…" : "")}</p>
          {error && (
            <button
              type="button"
              onClick={() => loadMore()}
              className="min-h-11 rounded-full border-[1.5px] border-line-strong px-4 text-sm font-semibold text-text hover:bg-surface-sunken"
            >
              Reintentar
            </button>
          )}
        </div>
      )}
      {nextOffset == null && (
        <p className="py-8 text-center text-sm text-text-muted">Eso es todo por ahora.</p>
      )}
    </div>
  );
}
