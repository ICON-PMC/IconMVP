"use client";

import { useFeedUrl } from "@/components/feed/use-feed-url";
import type { FilterGroup } from "@/components/feed/filter-panel";
import { Chip } from "@/components/chip";
import { Button } from "@/components/ui/button";

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

  // Spec 003: precio libre.
  const cop = new Intl.NumberFormat("es-CO");
  for (const [param, prefix] of [["pmin", "Desde $"], ["pmax", "Hasta $"]] as const) {
    const v = selected(param)[0];
    if (v && groups.some((g) => g.priceInputs)) active.push({ param, value: v, label: `${prefix}${cop.format(Number(v))}` });
  }

  if (active.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2">
      {active.map((chip) => (
        <Chip key={`${chip.param}:${chip.value}`} selected onRemove={() => remove(chip.param, chip.value)}>
          {chip.label}
        </Chip>
      ))}
      <Button type="button" variant="link" size="sm" onClick={() => clearFilters(["q", "sort"])}>
        Limpiar todo
      </Button>
    </div>
  );
}
