import { ChipSelect } from "@/components/chip-select";
import { MAX_GARMENT_TAGS_PER_TYPE, TAG_FIELDS, TAG_LABELS, type TagOptions } from "@/lib/tags";

const TYPES = ["style", "occasion", "temperature"] as const;

/**
 * Estilo, ocasión y clima de una prenda (hasta 3 de cada uno). Campos `styles`, `occasions`,
 * `temperatures`; se leen con `tagIdsFromForm`. La categoría va aparte, con su propio select.
 */
export function GarmentTagFields({
  options,
  defaultSelected = [],
}: {
  options: Pick<TagOptions, (typeof TYPES)[number]>;
  defaultSelected?: string[];
}) {
  return (
    <>
      {TYPES.map((t) => {
        const ids = new Set(options[t].map((o) => o.id));
        return (
          <ChipSelect
            key={t}
            name={TAG_FIELDS[t]}
            legend={TAG_LABELS[t]}
            options={options[t]}
            defaultSelected={defaultSelected.filter((id) => ids.has(id))}
            max={MAX_GARMENT_TAGS_PER_TYPE}
          />
        );
      })}
    </>
  );
}
