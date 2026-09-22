"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type ChipOption = { id: string; name: string };

/**
 * Selección múltiple con chips. Emite un `<input type="hidden">` por valor elegido, así que
 * funciona dentro de `<form action={serverAction}>` con los mismos nombres de campo de siempre
 * (`sizes`, `occasions`, `styles`, `temperatures`, `garments`).
 * Cada chip es un botón `aria-pressed` de al menos 44 px de alto en móvil.
 */
export function ChipSelect({
  name,
  legend,
  options,
  defaultSelected = [],
  className,
}: {
  name: string;
  legend: string;
  options: ChipOption[];
  defaultSelected?: string[];
  className?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink/60">
        {legend}
        {selected.size > 0 && <span className="ml-1.5 text-forest">· {selected.size}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.has(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.id)}
              className={cn(
                "glass-input inline-flex min-h-11 items-center rounded-full px-4 text-sm transition-colors md:min-h-8 md:px-3 md:text-xs",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                on ? "!border-forest !bg-forest text-white" : "text-ink/80 hover:bg-white/70",
              )}
            >
              {o.name}
            </button>
          );
        })}
      </div>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </fieldset>
  );
}
