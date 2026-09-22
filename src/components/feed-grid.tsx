"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FeedCard } from "@/components/feed-card";
import type { FeedItem } from "@/lib/feed";

type SavedIds = { posts: Set<string>; garments: Set<string> };

function itemKey(item: FeedItem) {
  return `${item.kind}:${item.id}`;
}

// Grilla masonry del feed mixto con scroll infinito. Recibe la primera página ya
// renderizada en el servidor y pide el resto a /api/feed con los mismos filtros/orden.
// Se remonta (key derivada de los searchParams, puesta por quien la usa) al cambiar filtros.
export function FeedGrid({
  initialItems,
  initialNextOffset,
  initialSaved,
  tagNames,
}: {
  initialItems: FeedItem[];
  initialNextOffset: number | null;
  initialSaved: SavedIds;
  tagNames: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || nextOffset == null) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("offset", String(nextOffset));
      const res = await fetch(`/api/feed?${params}`);
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
      setNextOffset(data.nextOffset ?? null);
    } catch {
      setError("No pudimos cargar más contenido. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [loading, nextOffset, searchParams]);

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
      <div className="columns-2 gap-4 md:columns-3">
        {items.map((item) => (
          <FeedCard
            key={itemKey(item)}
            item={item}
            tagNames={tagNames}
            saved={item.kind === "post" ? saved.posts.has(item.id) : saved.garments.has(item.id)}
            path="/feed"
          />
        ))}
      </div>
      {nextOffset != null && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <p className="text-sm text-ink/40">
            {error ?? (loading ? "Cargando más…" : "")}
          </p>
        </div>
      )}
      {nextOffset == null && (
        <p className="py-8 text-center text-sm text-ink/40">Eso es todo por ahora.</p>
      )}
    </div>
  );
}
