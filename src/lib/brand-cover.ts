import type { createClient } from "@/lib/supabase/server";
import { deleteFromR2 } from "@/lib/r2";
import { StorageQuotaError } from "@/lib/storage-quota";
import { uploadImageField } from "@/lib/upload";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const MAX_COVER_BYTES = 10 * 1024 * 1024;

/**
 * Sube la portada de una marca (campo `image`) y reemplaza la anterior, que se borra de R2.
 * Usada por el registro (paso 2) y por Panel → Perfil. Clave nueva en cada cambio: reusar la
 * misma pisaría el archivo y el borrado de la vieja se llevaría la nueva.
 * Devuelve `null` si salió bien, o el mensaje de error para la persona.
 */
export async function saveBrandCoverImage(
  supabase: Supabase,
  brandId: string,
  formData: FormData,
  quotaFor: string | undefined,
): Promise<string | null> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return "Elige una foto de portada.";
  if (!file.type.startsWith("image/")) return "El archivo debe ser una imagen (JPG, PNG o WebP).";
  if (file.size > MAX_COVER_BYTES) return "La imagen pesa más de 10 MB. Prueba con una más liviana.";

  const { data: current } = await supabase.from("brands").select("logo_url").eq("id", brandId).maybeSingle();

  let img: Awaited<ReturnType<typeof uploadImageField>>;
  try {
    img = await uploadImageField(formData, `brands/${brandId}/cover/${Date.now()}`, "image", {
      enforceQuotaFor: quotaFor,
    });
  } catch (e) {
    if (e instanceof StorageQuotaError) return e.message;
    console.error("[portada] subida falló:", e);
    return "No pudimos subir la imagen. Intenta de nuevo.";
  }
  if (!img) return "Elige una foto de portada.";

  const { error } = await supabase
    .from("brands")
    .update({ logo_url: img.key, logo_bytes: img.bytes })
    .eq("id", brandId);
  if (error) {
    console.error("[portada] guardar falló:", error.code, error.message);
    await deleteFromR2([img.key]);
    return "No pudimos guardar la imagen. Intenta de nuevo.";
  }
  if (current?.logo_url && current.logo_url !== img.key) await deleteFromR2([current.logo_url]);
  return null;
}
