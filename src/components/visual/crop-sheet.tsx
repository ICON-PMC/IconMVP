"use client";

import { useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { ResponsiveSheet } from "@/components/responsive-sheet";

type Rect = { x: number; y: number; w: number; h: number }; // fracciones 0–1
type Drag = { mode: "move" | "nw" | "se"; startX: number; startY: number; rect: Rect };

const MIN = 0.12;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Recorte manual (spec 005, US2 v1): un recuadro que se mueve arrastrando y se ajusta desde las
 * esquinas, con dedo o mouse. "Buscar esta parte" devuelve el recuadro en fracciones de la imagen.
 */
export function CropSheet({
  open,
  onOpenChange,
  src,
  busy,
  error,
  onSearch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  busy: boolean;
  error: string | null;
  onSearch: (rect: Rect) => void;
}) {
  const [rect, setRect] = useState<Rect>({ x: 0.15, y: 0.15, w: 0.7, h: 0.7 });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  // Un solo manejador: el modo sale del atributo data-mode del elemento tocado.
  function start(e: React.PointerEvent) {
    const mode = (e.target as HTMLElement).dataset.mode as Drag["mode"] | undefined;
    if (!mode) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, rect };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    const el = box.current;
    if (!d || !el) return;
    const { width, height } = el.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / width;
    const dy = (e.clientY - d.startY) / height;
    const r = d.rect;
    if (d.mode === "move") {
      setRect({ ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) });
    } else if (d.mode === "se") {
      setRect({ ...r, w: clamp(r.w + dx, MIN, 1 - r.x), h: clamp(r.h + dy, MIN, 1 - r.y) });
    } else {
      const x = clamp(r.x + dx, 0, r.x + r.w - MIN);
      const y = clamp(r.y + dy, 0, r.y + r.h - MIN);
      setRect({ x, y, w: r.w + (r.x - x), h: r.h + (r.y - y) });
    }
  }

  const handle = "absolute size-6 rounded-full border-2 border-white bg-forest shadow touch-none";

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Recortar la prenda"
      description="Ajusta el recuadro sobre la prenda que quieres buscar."
      footer={
        <button
          type="button"
          disabled={busy}
          onClick={() => onSearch(rect)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-white hover:bg-forest-deep disabled:opacity-60"
        >
          {busy && <Loader2Icon className="size-4 animate-spin" />} Buscar esta parte
        </button>
      }
    >
      <div
        ref={box}
        className="relative mx-auto w-full max-w-sm touch-none select-none overflow-hidden rounded-2xl"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL local, no pasa por next/image */}
        <img src={src} alt="Tu foto" className="block w-full" draggable={false} />
        <div
          role="presentation"
          className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
          }}
          data-mode="move"
        >
          <span data-mode="nw" className={`${handle} -left-3 -top-3 cursor-nwse-resize`} />
          <span data-mode="se" className={`${handle} -bottom-3 -right-3 cursor-nwse-resize`} />
        </div>
      </div>
      {error && (
        <p className="mt-3 text-sm text-coral" role="alert">
          {error}
        </p>
      )}
    </ResponsiveSheet>
  );
}
