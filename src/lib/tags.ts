import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type TagOption = { id: string; name: string };
export type TagType = "category" | "style" | "occasion" | "temperature";
// `color` no es un tipo de etiqueta (va en `colors`/`garment_colors`, spec 004) pero viaja
// junto al vocabulario para que los formularios de prenda lo reciban en un solo objeto.
export type TagOptions = Record<TagType, TagOption[]> & { color: TagOption[] };

// Límites de la base (triggers de 20261114000000_open_styles.sql y 20261114010000_colors.sql),
// repetidos aquí para que los chips dejen de aceptar selecciones antes de que la base dé el error.
export const MAX_BRAND_STYLES = 10;
export const MAX_GARMENT_TAGS_PER_TYPE = 3;
export const MAX_GARMENT_STYLES = 6;
export const MAX_GARMENT_COLORS = 3;

// Campo del formulario por tipo: los mismos nombres que ya usa `setPostTags`.
export const TAG_FIELDS = {
  style: "styles",
  occasion: "occasions",
  temperature: "temperatures",
} as const;

/** Campo del formulario con los ids de color elegidos. */
export const COLOR_FIELD = "colors";

export const TAG_LABELS: Record<TagType, string> = {
  category: "Categoría",
  style: "Estilo",
  occasion: "Ocasión",
  temperature: "Clima",
};

/** Todo el vocabulario agrupado por tipo (por nombre) y los colores (por su orden). Sin ocultos. */
export async function getTagOptions(supabase: Supabase): Promise<TagOptions> {
  const [{ data }, { data: colors }] = await Promise.all([
    supabase.from("tags").select("id, name, type").eq("is_hidden", false).order("name"),
    supabase.from("colors").select("id, name").eq("is_hidden", false).order("position").order("name"),
  ]);
  const out: TagOptions = { ...emptyTagOptions(), color: (colors ?? []).map((c) => ({ id: c.id, name: c.name })) };
  for (const t of data ?? []) out[t.type]?.push({ id: t.id, name: t.name });
  return out;
}

/** Ids de color elegidos en un formulario (campo `COLOR_FIELD`). */
export function colorIdsFromForm(formData: FormData): string[] {
  return [...new Set(formData.getAll(COLOR_FIELD).map(String))].filter(Boolean);
}

/** Reemplaza los colores de una prenda (el trigger reescribe `garments.color`). */
export async function replaceGarmentColors(
  supabase: Supabase,
  garmentId: string,
  colorIds: string[],
): Promise<string | null> {
  const { error: delError } = await supabase.from("garment_colors").delete().eq("garment_id", garmentId);
  if (delError) return delError.message;
  if (!colorIds.length) return null;
  const { error } = await supabase
    .from("garment_colors")
    .insert(colorIds.map((color_id) => ({ garment_id: garmentId, color_id })));
  return error?.message ?? null;
}

/** Ids de color de una prenda (para precargar el formulario de edición). */
export async function getGarmentColorIds(supabase: Supabase, garmentIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!garmentIds.length) return out;
  const { data } = await supabase.from("garment_colors").select("garment_id, color_id").in("garment_id", garmentIds);
  for (const r of data ?? []) out.set(r.garment_id, [...(out.get(r.garment_id) ?? []), r.color_id]);
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

function emptyTagOptions(): TagOptions {
  return { category: [], style: [], occasion: [], temperature: [], color: [] };
}

export const EMPTY_TAG_OPTIONS: TagOptions = emptyTagOptions();

/** Nombres de los estilos de cada marca (tarjetas de la búsqueda). */
export async function getBrandStyleNames(
  supabase: Supabase,
  brandIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!brandIds.length) return out;
  const { data: links } = await supabase
    .from("brand_tags")
    .select("brand_id, tag_id")
    .in("brand_id", brandIds);
  const tagIds = [...new Set((links ?? []).map((l) => l.tag_id))];
  if (!tagIds.length) return out;
  const { data: tags } = await supabase.from("tags").select("id, name").in("id", tagIds).order("name");
  const names = new Map((tags ?? []).map((t) => [t.id, t.name]));
  for (const l of links ?? []) {
    const name = names.get(l.tag_id);
    if (name) out.set(l.brand_id, [...(out.get(l.brand_id) ?? []), name]);
  }
  for (const list of out.values()) list.sort((a, b) => a.localeCompare(b));
  return out;
}
