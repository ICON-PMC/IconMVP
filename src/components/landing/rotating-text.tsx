"use client";

import { useEffect, useState, type ReactNode } from "react";

// Rota entre varias frases (globo "Necesito un…", "tu ciudad"). Respeta reducir movimiento:
// en ese caso se queda en la primera frase.
export function RotatingText({ items, every = 3800 }: { items: ReactNode[]; every?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), every);
    return () => clearInterval(t);
  }, [items.length, every]);
  return <span aria-live="off">{items[i]}</span>;
}
