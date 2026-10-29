import type { createClient } from "@/lib/supabase/server";
import { imageKeysFor } from "@/lib/image-keys";
import { deleteFromR2 } from "@/lib/r2";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const norm = (v: string) => v.trim().toLocaleLowerCase("es");

/** ¿Lo escrito coincide con el nombre de la marca? (sin mayúsculas ni espacios de los bordes). */
export function brandNameMatches(typed: string, name: string): boolean {
  return norm(typed) === norm(name);
}

/**
 * Borra una marca con todo su contenido (RPC `close_brand`: dueño o staff) y después sus
 * imágenes de R2. Las claves se leen antes: la cascada se lleva las filas que las guardan.
 * Devuelve el mensaje de error o null.
 */
export async function deleteBrandWithImages(supabase: Supabase, brandId: string): Promise<string | null> {
  const keys = await imageKeysFor(supabase, { brandId });
  const { error } = await supabase.rpc("close_brand", { p_brand_id: brandId });
  if (error) return error.message;
  await deleteFromR2(keys);
  return null;
}
