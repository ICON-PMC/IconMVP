"use client";

import { useEffect, useRef, useState } from "react";
import { GarmentCard } from "@/components/garment-card";

export type BrandGarment = { id: string; title: string; price_cop: number | null; image: string | null; likeCount: number };

const BATCH = 24;

/**
 * Prendas de la página de marca por tandas (spec 006, FR-019): se pintan 24 y el resto aparece al
 * bajar. Los datos de cada prenda son pocos bytes; lo que se evita es pintar (y pedir fotos de)
 * decenas de tarjetas de una vez.
 */
export function BrandGarments({
  garments,
  savedIds,
  likedIds,
  isLoggedIn,
  path,
}: {
  garments: BrandGarment[];
  savedIds: string[];
  likedIds: string[];
  isLoggedIn: boolean;
  path: string;
}) {
  const [shown, setShown] = useState(BATCH);
  const sentinel = useRef<HTMLDivElement>(null);
  const saved = new Set(savedIds);
  const liked = new Set(likedIds);
  const more = shown < garments.length;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && setShown((n) => n + BATCH), {
      rootMargin: "600px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [more]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {garments.slice(0, shown).map((g) => (
          <GarmentCard
            key={g.id}
            id={g.id}
            title={g.title}
            price_cop={g.price_cop}
            image={g.image}
            saved={saved.has(g.id)}
            liked={liked.has(g.id)}
            likeCount={g.likeCount}
            isLoggedIn={isLoggedIn}
            path={path}
          />
        ))}
      </div>
      {more && (
        <div ref={sentinel} className="flex justify-center py-6">
          <button
            type="button"
            onClick={() => setShown((n) => n + BATCH)}
            className="bg-surface-raised border-[1.5px] border-line text-text focus:border-line-strong focus:outline-none min-h-11 rounded-full px-4 text-sm font-medium text-ink/80 hover:bg-surface-sunken"
          >
            Ver más prendas ({garments.length - shown})
          </button>
        </div>
      )}
    </>
  );
}
