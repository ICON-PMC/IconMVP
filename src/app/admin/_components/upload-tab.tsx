import { GlassCard } from "@/components/glass-card";
import { FormField } from "@/components/form-field";
import { ChipSelect } from "@/components/chip-select";
import { LinkTabs } from "@/components/link-tabs";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRICE_BUCKETS } from "@/lib/taxonomy";
import { createBrand, createGarment, createPost } from "../actions";
import { GarmentsField } from "./garments-field";

export type UploadForm = "marca" | "prenda" | "post";

export function parseUploadForm(v: string | undefined): UploadForm {
  return v === "prenda" || v === "post" ? v : "marca";
}

type Named = { id: string; name: string };

export type UploadData = {
  cities: Named[];
  categories: Named[];
  occasions: Named[];
  styles: Named[];
  temperatures: Named[];
  sizes: { id: string; label: string }[];
  brands: Named[];
  garments: { id: string; title: string }[];
};

const submit = "w-full rounded-full sm:w-auto sm:self-start sm:px-8";
const grid = "grid grid-cols-1 gap-4 sm:grid-cols-2";

/** Un solo formulario visible a la vez (marca / prenda / post), elegido por `?form=`. */
export function UploadTab({ form, data }: { form: UploadForm; data: UploadData }) {
  return (
    <div className="space-y-5">
      <LinkTabs
        size="sm"
        label="Qué quieres crear"
        active={form}
        tabs={[
          { id: "marca", label: "Marca", href: "/admin?tab=cargar&form=marca" },
          { id: "prenda", label: "Prenda", href: "/admin?tab=cargar&form=prenda" },
          { id: "post", label: "Post (look)", href: "/admin?tab=cargar&form=post" },
        ]}
      />
      <GlassCard className="p-5">
        {form === "marca" && <BrandForm data={data} />}
        {form === "prenda" && <GarmentForm data={data} />}
        {form === "post" && <PostForm data={data} />}
      </GlassCard>
    </div>
  );
}

function BrandForm({ data }: { data: UploadData }) {
  return (
    <form action={createBrand} className="flex flex-col gap-4">
      <div className={grid}>
        <FormField label="Nombre" htmlFor="b-name">
          <Input id="b-name" name="name" required />
        </FormField>
        <FormField label="Slug" htmlFor="b-slug" hint="Parte de la URL, en minúsculas.">
          <Input id="b-slug" name="slug" required placeholder="mi-marca" autoCapitalize="none" />
        </FormField>
        <FormField label="Ciudad" htmlFor="b-city">
          <NativeSelect id="b-city" name="city_id" defaultValue="">
            <option value="">—</option>
            {data.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Rango de precio" htmlFor="b-price">
          <NativeSelect id="b-price" name="price_range" defaultValue="">
            <option value="">—</option>
            {PRICE_BUCKETS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Tienda online" htmlFor="b-store">
          <Input id="b-store" name="store_url" type="url" inputMode="url" placeholder="https://" />
        </FormField>
        <FormField label="Instagram" htmlFor="b-ig">
          <Input id="b-ig" name="instagram" placeholder="marca.co" autoCapitalize="none" />
        </FormField>
      </div>
      <FormField label="Bio" htmlFor="b-bio">
        <Input id="b-bio" name="bio" />
      </FormField>
      <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
        <CheckRow name="is_verified" label="Verificada" />
        <CheckRow name="is_sustainable" label="Sostenible" />
      </div>
      <Button type="submit" size="lg" className={submit}>
        Crear marca
      </Button>
    </form>
  );
}

function CheckRow({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm text-ink/80">
      <input type="checkbox" name={name} className="size-5 accent-forest" /> {label}
    </label>
  );
}

function GarmentForm({ data }: { data: UploadData }) {
  return (
    <form action={createGarment} className="flex flex-col gap-4">
      <div className={grid}>
        <FormField label="Marca" htmlFor="g-brand">
          <NativeSelect id="g-brand" name="brand_id" required defaultValue="">
            <option value="" disabled>
              Elige marca
            </option>
            {data.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Título" htmlFor="g-title">
          <Input id="g-title" name="title" required />
        </FormField>
        <FormField label="Precio (COP)" htmlFor="g-price">
          <Input id="g-price" name="price_cop" type="number" min="0" inputMode="numeric" />
        </FormField>
        <FormField label="Enlace del producto" htmlFor="g-url">
          <Input id="g-url" name="product_url" type="url" inputMode="url" placeholder="https://" />
        </FormField>
        <FormField label="Color" htmlFor="g-color">
          <Input id="g-color" name="color" />
        </FormField>
        <FormField label="Tela" htmlFor="g-fabric">
          <Input id="g-fabric" name="fabric" />
        </FormField>
        <FormField label="Categoría" htmlFor="g-cat">
          <NativeSelect id="g-cat" name="category" defaultValue="">
            <option value="">—</option>
            {data.categories.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Estado" htmlFor="g-status">
          <NativeSelect id="g-status" name="status" defaultValue="published">
            <option value="published">Publicada</option>
            <option value="pending">Pendiente</option>
            <option value="archived">Archivada</option>
          </NativeSelect>
        </FormField>
      </div>
      <FormField label="Descripción" htmlFor="g-desc">
        <Textarea id="g-desc" name="description" rows={3} />
      </FormField>
      <ChipSelect
        name="sizes"
        legend="Tallas"
        options={data.sizes.map((s) => ({ id: s.id, name: s.label }))}
      />
      <FormField label="Foto" htmlFor="g-image">
        <Input id="g-image" name="image" type="file" accept="image/*" />
      </FormField>
      <Button type="submit" size="lg" className={submit}>
        Crear prenda
      </Button>
    </form>
  );
}

function PostForm({ data }: { data: UploadData }) {
  return (
    <form action={createPost} className="flex flex-col gap-4">
      <div className={grid}>
        <FormField label="Marca autora" htmlFor="p-brand">
          <NativeSelect id="p-brand" name="author_brand_id" required defaultValue="">
            <option value="" disabled>
              Elige marca
            </option>
            {data.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Estado" htmlFor="p-status">
          <NativeSelect id="p-status" name="status" defaultValue="published">
            <option value="published">Publicado</option>
            <option value="draft">Borrador</option>
            <option value="archived">Archivado</option>
          </NativeSelect>
        </FormField>
      </div>
      <FormField label="Caption" htmlFor="p-caption">
        <Input id="p-caption" name="caption" />
      </FormField>
      <ChipSelect name="occasions" legend="Ocasión" options={data.occasions} />
      <ChipSelect name="styles" legend="Estilo" options={data.styles} />
      <ChipSelect name="temperatures" legend="Temperatura" options={data.temperatures} />
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink/60">
          Prendas en el look
        </p>
        <GarmentsField options={data.garments.map((g) => ({ id: g.id, label: g.title }))} />
      </div>
      <FormField label="Foto del look" htmlFor="p-image">
        <Input id="p-image" name="image" type="file" accept="image/*" />
      </FormField>
      <Button type="submit" size="lg" className={submit}>
        Crear post
      </Button>
    </form>
  );
}
