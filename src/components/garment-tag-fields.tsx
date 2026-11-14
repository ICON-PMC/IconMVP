import { ChipSelect } from "@/components/chip-select";
import {
  COLOR_FIELD,
  MAX_GARMENT_COLORS,
  MAX_GARMENT_STYLES,
  MAX_GARMENT_TAGS_PER_TYPE,
  TAG_FIELDS,
  TAG_LABELS,
  type TagOptions,
} from "@/lib/tags";

const TYPES = ["style", "occasion", "temperature"] as const;

/**
 * Estilo (hasta 6), ocasión y clima (hasta 3) y color (hasta 3) de una prenda. Campos `styles`,
 * `occasions`, `temperatures` (se leen con `tagIdsFromForm`) y `colors` (`colorIdsFromForm`).
 * La categoría va aparte, con su propio select. `defaultSelected` mezcla ids de etiquetas y de colores.
 */
export function GarmentTagFields({
  options,
  defaultSelected = [],
}: {
  options: Pick<TagOptions, (typeof TYPES)[number]> & Partial<Pick<TagOptions, "color">>;
  defaultSelected?: string[];
}) {
  const colorIds = new Set((options.color ?? []).map((o) => o.id));
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
            max={t === "style" ? MAX_GARMENT_STYLES : MAX_GARMENT_TAGS_PER_TYPE}
          />
        );
      })}
      {options.color?.length ? (
        <ChipSelect
          name={COLOR_FIELD}
          legend="Color"
          options={options.color}
          defaultSelected={defaultSelected.filter((id) => colorIds.has(id))}
          max={MAX_GARMENT_COLORS}
        />
      ) : null}
    </>
  );
}
