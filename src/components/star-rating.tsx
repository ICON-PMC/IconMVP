"use client";

import { useRef } from "react";
import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const LABEL = ["", "1 estrella", "2 estrellas", "3 estrellas", "4 estrellas", "5 estrellas"];

type Props =
  | { mode: "display"; value: number; size?: 16 | 20 | 32; className?: string }
  | { mode: "input"; value: number; onChange(v: number): void; name: string; className?: string; invalid?: boolean };

/** Estrellas (spec 011, contracts §3): de lectura (con medias) o de entrada (radiogroup accesible). */
export function StarRating(props: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (props.mode === "display") {
    const size = props.size ?? 16;
    return (
      <span className={cn("inline-flex items-center gap-0.5", props.className)} role="img" aria-label={`${props.value.toLocaleString("es-CO")} de 5 estrellas`}>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, props.value - (i - 1)));
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }} aria-hidden>
              <StarIcon className="absolute inset-0 text-line-strong" style={{ width: size, height: size }} />
              {fill > 0 && (
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                  <StarIcon className="fill-honey text-ink" style={{ width: size, height: size }} />
                </span>
              )}
            </span>
          );
        })}
      </span>
    );
  }

  const { value, onChange, name, invalid } = props;
  function onKey(e: React.KeyboardEvent, i: number) {
    const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? Math.min(5, i + 1) : e.key === "ArrowLeft" || e.key === "ArrowDown" ? Math.max(1, i - 1) : null;
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-label="Estrellas" aria-invalid={invalid || undefined} className={cn("flex", props.className)}>
      <input type="hidden" name={name} value={value || ""} />
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={LABEL[i]}
          tabIndex={value === i || (!value && i === 1) ? 0 : -1}
          onClick={() => onChange(i)}
          onKeyDown={(e) => onKey(e, i)}
          className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
        >
          <StarIcon className={cn("size-8", i <= value ? "fill-honey text-ink" : "text-line-strong")} aria-hidden />
        </button>
      ))}
    </div>
  );
}
