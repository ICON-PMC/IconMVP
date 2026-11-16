"use client";

import { Chip } from "@/components/chip";

import { useFeedUrl } from "@/components/feed/use-feed-url";
import type { SuggestionChip } from "@/lib/suggestions";

// Chips de sugerencia (ciudad + estilos del onboarding, o etiquetas populares para
// visitantes). Un clic activa/desactiva el mismo filtro que usa el panel — sin
// cambio en el ranking, solo atajos.
export function FeedSuggestions({ chips }: { chips: SuggestionChip[] }) {
  const { selected, toggle } = useFeedUrl();

  if (chips.length === 0) return null;

  return (
    <div className="mb-2 flex gap-2 overflow-x-auto">
      {chips.map((chip) => (
        <Chip
          key={`${chip.param}:${chip.value}`}
          selected={selected(chip.param).includes(chip.value)}
          onClick={() => toggle(chip.param, chip.value)}
        >
          {chip.label}
        </Chip>
      ))}
    </div>
  );
}
