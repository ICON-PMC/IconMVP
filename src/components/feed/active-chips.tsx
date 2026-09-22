"use client";

import { useFeedUrl } from "@/components/feed/use-feed-url";
import type { FilterGroup } from "@/components/feed/filter-panel";

// Fila de chips removibles sobre la grilla, uno por cada valor de filtro activo
// (en cualquier grupo), más "Limpiar todo". Los filtros de búsqueda (`q`) y el
// orden (`sort`) no aparecen aquí: viven en la barra superior.
export function FeedActiveChips({ groups }: { groups: FilterGroup[] }) {
  const { selected, remove, clearFilters } = useFeedUrl();

  const active = groups.flatMap((g) =>
    selected(g.param).map((value) => ({
      param: g.param,
      value,
      label: g.options.find((o) => o.value === value)?.label ?? value,
    })),
  );

  if (active.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {active.map((chip) => (
        <button
          key={`${chip.param}:${chip.value}`}
          type="button"
          onClick={() => remove(chip.param, chip.value)}
          className="flex items-center gap-1 rounded-full bg-forest px-3 py-1 text-xs font-medium text-white hover:bg-forest-deep"
        >
          {chip.label}
          <span aria-hidden>×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => clearFilters(["q", "sort"])}
        className="text-xs font-medium text-coral hover:underline"
      >
        Limpiar todo
      </button>
    </div>
  );
}
