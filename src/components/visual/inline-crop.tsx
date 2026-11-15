"use client";

import { useRef, useState } from "react";

export type CropRect = { x: number; y: number; w: number; h: number }; // fracciones 0–1
type Mode = "move" | "nw" | "ne" | "sw" | "se";
type Drag = { mode: Mode; startX: number; startY: number; rect: CropRect };

const MIN = 0.12;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Recorte directo sobre la foto (spec 005, US2 v1, estilo Pinterest): esquinas que se arrastran
 * para ajustar y el recuadro se mueve arrastrándolo. Al soltar se llama `onCommit` con el nuevo
 * recuadro (la búsqueda se rehace sola). Funciona con dedo y mouse.
 */
export function InlineCrop({
  src,
  rect: committed,
  onCommit,
  disabled,
}: {
  src: string;
  rect: CropRect;
  onCommit: (rect: CropRect) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<CropRect | null>(null);
  const rect = draft ?? committed;
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  function start(e: React.PointerEvent) {
    if (disabled) return;
    const mode = (e.target as HTMLElement).dataset.mode as Mode | undefined;
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
      setDraft({ ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) });
      return;
    }
    let { x, y, w, h } = r;
    if (d.mode === "nw" || d.mode === "sw") {
      const nx = clamp(r.x + dx, 0, r.x + r.w - MIN);
      w = r.w + (r.x - nx);
      x = nx;
    } else {
      w = clamp(r.w + dx, MIN, 1 - r.x);
    }
    if (d.mode === "nw" || d.mode === "ne") {
      const ny = clamp(r.y + dy, 0, r.y + r.h - MIN);
      h = r.h + (r.y - ny);
      y = ny;
    } else {
      h = clamp(r.h + dy, MIN, 1 - r.y);
    }
    setDraft({ x, y, w, h });
  }

  function end() {
    if (!drag.current) return;
    drag.current = null;
    if (draft) {
      onCommit(draft);
      setDraft(null);
    }
  }

  // Esquinas en "L" blancas, como un visor de cámara.
  const corner = "absolute size-7 touch-none border-white";
  return (
    <div
      ref={box}
      className="relative mx-auto w-fit max-w-full touch-none select-none overflow-hidden rounded-3xl"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL local, no pasa por next/image */}
      <img src={src} alt="Tu foto" className="block h-auto max-h-[45vh] w-auto max-w-full md:max-h-[75vh]" draggable={false} />
      <div
        data-mode="move"
        role="presentation"
        className="absolute cursor-move shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
        style={{
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.w * 100}%`,
          height: `${rect.h * 100}%`,
        }}
      >
        <span data-mode="nw" className={`${corner} left-1 top-1 cursor-nwse-resize rounded-tl-lg border-l-4 border-t-4`} />
        <span data-mode="ne" className={`${corner} right-1 top-1 cursor-nesw-resize rounded-tr-lg border-r-4 border-t-4`} />
        <span data-mode="sw" className={`${corner} bottom-1 left-1 cursor-nesw-resize rounded-bl-lg border-b-4 border-l-4`} />
        <span data-mode="se" className={`${corner} bottom-1 right-1 cursor-nwse-resize rounded-br-lg border-b-4 border-r-4`} />
      </div>
    </div>
  );
}
