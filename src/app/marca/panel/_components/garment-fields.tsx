import { FormField } from "@/components/form-field";
import { ChipSelect } from "@/components/chip-select";
import { GarmentTagFields } from "@/components/garment-tag-fields";
import { NativeSelect } from "@/components/native-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TagOptions } from "@/lib/tags";

export type GarmentDefaults = {
  title: string;
  price_cop: number | null;
  product_url: string | null;
  color: string | null;
  fabric: string | null;
  description: string | null;
  categoryId: string;
  sizeIds: string[];
  tagIds: string[];
};

/**
 * Campos de una prenda, compartidos por "Nueva prenda" y "Editar prenda". Sin `defaults`, la
 * foto es obligatoria (crear); con `defaults`, es opcional (solo si se quiere cambiar).
 * `idPrefix` evita ids repetidos si los dos formularios llegan a estar montados a la vez.
 */
export function GarmentFields({
  tagOptions,
  sizes,
  defaults,
  idPrefix = "g",
}: {
  tagOptions: TagOptions;
  sizes: { id: string; label: string }[];
  defaults?: GarmentDefaults;
  idPrefix?: string;
}) {
  const id = (f: string) => `${idPrefix}-${f}`;
  return (
    <>
      <FormField
        label={defaults ? "Cambiar foto" : "Foto"}
        htmlFor={id("image")}
        hint={defaults ? "Déjalo vacío para mantener la actual." : undefined}
      >
        <Input id={id("image")} name="image" type="file" accept="image/*" required={!defaults} />
      </FormField>
      <FormField label="Título" htmlFor={id("title")}>
        <Input id={id("title")} name="title" required defaultValue={defaults?.title} />
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Precio (COP)" htmlFor={id("price")}>
          <Input
            id={id("price")}
            name="price_cop"
            type="number"
            min="0"
            inputMode="numeric"
            defaultValue={defaults?.price_cop ?? undefined}
          />
        </FormField>
        <FormField label="Categoría" htmlFor={id("category")}>
          <NativeSelect id={id("category")} name="category" defaultValue={defaults?.categoryId ?? ""}>
            <option value="">—</option>
            {tagOptions.category.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Enlace del producto" htmlFor={id("url")}>
          <Input
            id={id("url")}
            name="product_url"
            type="text"
            inputMode="url"
            placeholder="https://"
            defaultValue={defaults?.product_url ?? undefined}
          />
        </FormField>
        <FormField label="Color" htmlFor={id("color")}>
          <Input id={id("color")} name="color" defaultValue={defaults?.color ?? undefined} />
        </FormField>
        <FormField label="Tela" htmlFor={id("fabric")}>
          <Input id={id("fabric")} name="fabric" defaultValue={defaults?.fabric ?? undefined} />
        </FormField>
      </div>
      <FormField label="Descripción" htmlFor={id("desc")}>
        <Textarea id={id("desc")} name="description" rows={3} defaultValue={defaults?.description ?? undefined} />
      </FormField>
      <ChipSelect
        name="sizes"
        legend="Tallas"
        options={sizes.map((s) => ({ id: s.id, name: s.label }))}
        defaultSelected={defaults?.sizeIds}
      />
      <GarmentTagFields options={tagOptions} defaultSelected={defaults?.tagIds} />
    </>
  );
}
