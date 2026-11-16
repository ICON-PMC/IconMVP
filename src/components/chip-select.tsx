"use client";

import { useState } from "react";
import { Chip } from "@/components/chip";
import { cn } from "@/lib/utils";

export type ChipOption = { id: string; name: string };

/**
 * Selección múltiple con chips. Emite un `<input type="hidden">` por valor elegido, así que
 * funciona dentro de `<form action={serverAction}>` con los mismos nombres de campo de siempre
 * (`sizes`, `occasions`, `styles`, `temperatures`, `garments`).
 * Cada chip es un botón `aria-pressed` de al menos 44 px de alto en móvil.
 * Con `max`, al llegar al límite los chips no elegidos se deshabilitan.
 */
export function ChipSelect({
  name,
  legend,
  options,
  defaultSelected = [],
  max,
  className,
}: {
  name: string;
  legend: string;
  options: ChipOption[];
  defaultSelected?: string[];
  max?: number;
  className?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));
  const full = max != null && selected.size >= max;

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
      <legend className="mb-1 text-label text-text">
        {legend}
        {selected.size > 0 && (
          <span className="ml-1.5 text-text-muted">
            · {selected.size}
            {max != null && ` de ${max}`}
          </span>
        )}
      </legend>
      {/* Chips del sistema (spec 007): activo = coral con texto tinta. */}
      <div className="flex flex-wrap gap-x-2">
        {options.map((o) => {
          const on = selected.has(o.id);
          return (
            <Chip key={o.id} selected={on} disabled={full && !on} onClick={() => toggle(o.id)}>
              {o.name}
            </Chip>
          );
        })}
      </div>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </fieldset>
  );
}
