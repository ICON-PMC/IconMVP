"use client";

import { useEffect, type RefObject } from "react";
import { trackImpression, type ImpressionEvent } from "@/lib/events/client";

/** Registra una impresión cuando la tarjeta está ≥ 50 % visible durante 1 s; una vez por montaje. */
export function useImpression(ref: RefObject<Element | null>, e: ImpressionEvent | null | undefined) {
  const key = e ? `${e.itemKind}:${e.itemId}:${e.surface}:${e.position}` : null;
  useEffect(() => {
    const el = ref.current;
    if (!el || !e || typeof IntersectionObserver === "undefined") return;
    let t: ReturnType<typeof setTimeout> | null = null;
    let done = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (done) return;
        if (entry.isIntersecting) {
          t = setTimeout(() => {
            done = true;
            trackImpression(e);
            io.disconnect();
          }, 1000);
        } else if (t) {
          clearTimeout(t);
          t = null;
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      if (t) clearTimeout(t);
      io.disconnect();
    };
    // `key` resume el evento: no se reengancha en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
