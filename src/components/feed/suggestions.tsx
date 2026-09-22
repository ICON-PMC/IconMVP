"use client";

import { useFeedUrl } from "@/components/feed/use-feed-url";
import type { SuggestionChip } from "@/lib/suggestions";

// Chips de sugerencia (ciudad + estilos del onboarding, o etiquetas populares para
// visitantes). Un clic activa/desactiva el mismo filtro que usa el panel — sin
// cambio en el ranking, solo atajos.
export function FeedSuggestions({ chips }: { chips: SuggestionChip[] }) {
  const { selected, toggle } = useFeedUrl();

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
      {chips.map((chip) => {
        const active = selected(chip.param).includes(chip.value);
        return (
          <button
            key={`${chip.param}:${chip.value}`}
            type="button"
            onClick={() => toggle(chip.param, chip.value)}
            className={
              active
                ? "shrink-0 rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white"
                : "glass-input shrink-0 rounded-full px-3 py-1.5 text-sm text-ink/80 hover:bg-white/70"
            }
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
