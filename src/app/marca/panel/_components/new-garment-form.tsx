import { FormField } from "@/components/form-field";
import { ChipSelect } from "@/components/chip-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createBrandGarment } from "../actions";

// Selects nativos a propósito: en móvil abren el selector del sistema, que es la mejor UX para listas cortas.
const nativeSelect =
  "glass-input h-11 w-full rounded-lg px-2.5 text-base text-ink md:h-8 md:text-sm";

export function NewGarmentForm({
  categories,
  sizes,
}: {
  categories: { id: string; name: string }[];
  sizes: { id: string; label: string }[];
}) {
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-base font-medium text-forest [&::-webkit-details-marker]:hidden">
        Nueva prenda
        <span aria-hidden className="text-xl transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <form action={createBrandGarment} className="mt-4 flex flex-col gap-4">
        <FormField label="Título" htmlFor="g-title">
          <Input id="g-title" name="title" required />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Precio (COP)" htmlFor="g-price">
            <Input id="g-price" name="price_cop" type="number" min="0" inputMode="numeric" />
          </FormField>
          <FormField label="Categoría" htmlFor="g-category">
            <select id="g-category" name="category" defaultValue="" className={nativeSelect}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Enlace del producto" htmlFor="g-url">
            <Input id="g-url" name="product_url" type="url" inputMode="url" placeholder="https://" />
          </FormField>
          <FormField label="Color" htmlFor="g-color">
            <Input id="g-color" name="color" />
          </FormField>
        </div>
        <FormField label="Descripción" htmlFor="g-desc">
          <Textarea id="g-desc" name="description" rows={3} />
        </FormField>
        <ChipSelect
          name="sizes"
          legend="Tallas"
          options={sizes.map((s) => ({ id: s.id, name: s.label }))}
        />
        <FormField label="Foto" htmlFor="g-image">
          <Input id="g-image" name="image" type="file" accept="image/*" required />
        </FormField>
        <Button type="submit" size="lg" className="w-full rounded-full sm:w-auto sm:self-start sm:px-8">
          Agregar prenda
        </Button>
      </form>
    </details>
  );
}
