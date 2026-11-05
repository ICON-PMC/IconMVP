"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Aparece con un fade + subida suave al entrar en pantalla (clases de tw-animate-css).
// Sin JS o con "reducir movimiento" el contenido se ve normal desde el inicio.
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // ya visible: no animar
    setState("hidden");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cls =
    state === "hidden"
      ? "opacity-0"
      : state === "shown"
        ? "animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both"
        : "";
  return (
    <div ref={ref} className={`${cls} ${className}`}>
      {children}
    </div>
  );
}
