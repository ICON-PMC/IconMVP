import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type TagOption = { id: string; name: string };
export type TagType = "category" | "style" | "occasion" | "temperature";
export type TagOptions = Record<TagType, TagOption[]>;

// Límites de la base (triggers de 20261006000000_brand_tags.sql), repetidos aquí para que los
// chips dejen de aceptar selecciones antes de que la base dé el error.
export const MAX_BRAND_STYLES = 5;
export const MAX_GARMENT_TAGS_PER_TYPE = 3;

// Campo del formulario por tipo: los mismos nombres que ya usa `setPostTags`.
export const TAG_FIELDS = {
  style: "styles",
  occasion: "occasions",
  temperature: "temperatures",
} as const;

export const TAG_LABELS: Record<TagType, string> = {
  category: "Categoría",
  style: "Estilo",
  occasion: "Ocasión",
  temperature: "Clima",
};

/** Todo el vocabulario agrupado por tipo, ordenado por nombre. */
export async function getTagOptions(supabase: Supabase): Promise<TagOptions> {
  const { data } = await supabase.from("tags").select("id, name, type").order("name");
  const out: TagOptions = { category: [], style: [], occasion: [], temperature: [] };
  for (const t of data ?? []) out[t.type].push({ id: t.id, name: t.name });
  return out;
}

/** Ids de estilo/ocasión/clima elegidos en un formulario con los campos de `TAG_FIELDS`. */
export function tagIdsFromForm(formData: FormData, types: (keyof typeof TAG_FIELDS)[]): string[] {
  return [...new Set(types.flatMap((t) => formData.getAll(TAG_FIELDS[t]).map(String)))].filter(Boolean);
}

/** Ids de todas las opciones de esos tipos (lo que `replaceGarmentTags` puede tocar). */
export function idsOfTypes(options: TagOptions, types: TagType[]): string[] {
  return types.flatMap((t) => options[t].map((o) => o.id));
}

/**
 * Reemplaza los tags de una prenda dentro de `managedIds` (p. ej. solo estilo/ocasión/clima,
 * sin tocar la categoría). Borra primero para que los triggers de máximo cuenten solo lo nuevo.
 * Ignora ids elegidos que no estén en `managedIds`. Devuelve el mensaje de error o null.
 */
export async function replaceGarmentTags(
  supabase: Supabase,
  garmentId: string,
  managedIds: string[],
  tagIds: string[],
): Promise<string | null> {
  if (!managedIds.length) return null;
  const { error: delError } = await supabase
    .from("garment_tags")
    .delete()
    .eq("garment_id", garmentId)
    .in("tag_id", managedIds);
  if (delError) return delError.message;
  const managed = new Set(managedIds);
  const rows = tagIds.filter((id) => managed.has(id)).map((tag_id) => ({ garment_id: garmentId, tag_id }));
  if (!rows.length) return null;
  const { error } = await supabase.from("garment_tags").insert(rows);
  return error?.message ?? null;
}

/** Reemplaza los estilos de una marca. */
export async function replaceBrandStyles(
  supabase: Supabase,
  brandId: string,
  tagIds: string[],
): Promise<string | null> {
  const { error: delError } = await supabase.from("brand_tags").delete().eq("brand_id", brandId);
  if (delError) return delError.message;
  if (!tagIds.length) return null;
  const { error } = await supabase
    .from("brand_tags")
    .insert(tagIds.map((tag_id) => ({ brand_id: brandId, tag_id })));
  return error?.message ?? null;
}

export const EMPTY_TAG_OPTIONS: TagOptions = { category: [], style: [], occasion: [], temperature: [] };
