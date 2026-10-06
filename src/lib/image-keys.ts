import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Claves de R2 de prendas, looks y/o la portada de una marca. Se leen ANTES de borrar las filas
 * (después la cascada ya se las llevó) y se pasan a `deleteFromR2` cuando el borrado salió bien.
 * Con `brandId` incluye todo lo de la marca: prendas, looks y portada.
 */
export async function imageKeysFor(
  supabase: Supabase,
  { garmentIds = [], postIds = [], brandId }: { garmentIds?: string[]; postIds?: string[]; brandId?: string },
): Promise<string[]> {
  const keys: string[] = [];
  if (brandId) {
    const [garments, posts, brand] = await Promise.all([
      supabase.from("garments").select("id").eq("brand_id", brandId),
      supabase.from("posts").select("id").eq("author_brand_id", brandId),
      supabase.from("brands").select("logo_url").eq("id", brandId).maybeSingle(),
    ]);
    garmentIds = [...garmentIds, ...(garments.data ?? []).map((g) => g.id)];
    postIds = [...postIds, ...(posts.data ?? []).map((p) => p.id)];
    if (brand.data?.logo_url) keys.push(brand.data.logo_url);
  }
  const [gImgs, pImgs] = await Promise.all([
    garmentIds.length
      ? supabase.from("garment_images").select("cf_image_id").in("garment_id", garmentIds)
      : Promise.resolve({ data: [] as { cf_image_id: string }[] }),
    postIds.length
      ? supabase.from("post_images").select("cf_image_id").in("post_id", postIds)
      : Promise.resolve({ data: [] as { cf_image_id: string }[] }),
  ]);
  for (const r of [...(gImgs.data ?? []), ...(pImgs.data ?? [])]) keys.push(r.cf_image_id);
  return keys;
}
