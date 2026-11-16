import { IMAGE_VARIANT_WIDTHS, variantKey } from "@/lib/images";
import { getFromR2, uploadToR2 } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";

// Variantes de imagen (spec 006). Solo servidor.
// sharp se importa de forma lazy dentro de cada función (constitución V: a nivel de módulo rompe
// páginas en Vercel).

/**
 * Genera y sube las variantes de 320 y 640 px de una imagen ya procesada. Nunca lanza: devuelve
 * true solo si subieron las dos (si alguna falla, el cron la completa después).
 */
export async function uploadVariants(mainKey: string, mainBuffer: Buffer): Promise<boolean> {
  try {
    const { default: sharp } = await import("sharp");
    const results = await Promise.all(
      IMAGE_VARIANT_WIDTHS.map(async (w) => {
        const key = variantKey(mainKey, w);
        if (!key) return false;
        const out = await sharp(mainBuffer)
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer();
        await uploadToR2(key, out, "image/webp", { immutable: true });
        return true;
      }),
    );
    return results.every(Boolean);
  } catch (e) {
    console.error(`[image-variants] ${mainKey}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

type Pending = { table: "garment_images" | "post_images" | "brands"; id: string; key: string };

async function pendingBatch(limit: number): Promise<{ items: Pending[]; remaining: number }> {
  const admin = createAdminClient();
  const [g, p, b] = await Promise.all([
    admin.from("garment_images").select("id, cf_image_id", { count: "exact" }).eq("variants_ready", false).limit(limit),
    admin.from("post_images").select("id, cf_image_id", { count: "exact" }).eq("variants_ready", false).limit(limit),
    admin
      .from("brands")
      .select("id, logo_url", { count: "exact" })
      .eq("logo_variants_ready", false)
      .not("logo_url", "is", null)
      .limit(limit),
  ]);
  for (const r of [g, p, b]) if (r.error) throw new Error(r.error.message);
  const items: Pending[] = [
    ...(g.data ?? []).map((r) => ({ table: "garment_images" as const, id: r.id, key: r.cf_image_id })),
    ...(p.data ?? []).map((r) => ({ table: "post_images" as const, id: r.id, key: r.cf_image_id })),
    ...(b.data ?? []).map((r) => ({ table: "brands" as const, id: r.id, key: r.logo_url as string })),
  ].slice(0, limit);
  const remaining = (g.count ?? 0) + (p.count ?? 0) + (b.count ?? 0);
  return { items, remaining };
}

async function markReady(item: Pending) {
  const admin = createAdminClient();
  const { error } =
    item.table === "brands"
      ? await admin.from("brands").update({ logo_variants_ready: true }).eq("id", item.id)
      : await admin.from(item.table).update({ variants_ready: true }).eq("id", item.id);
  if (error) throw new Error(error.message);
}

/**
 * Completa hasta `limit` imágenes con variantes pendientes (usa service_role). Las claves que no son
 * de R2 se marcan listas sin generar nada. `onItem` sirve para que el script imprima el avance.
 */
export async function processPendingVariants(
  limit: number,
  onItem?: (item: Pending, ok: boolean, error?: string) => void,
): Promise<{ done: number; failed: number; remaining: number }> {
  const { items, remaining } = await pendingBatch(limit);
  let done = 0;
  let failed = 0;
  for (const item of items) {
    try {
      if (!variantKey(item.key, 320)) {
        await markReady(item);
        done++;
        onItem?.(item, true);
        continue;
      }
      const res = await getFromR2(item.key);
      if (!res) throw new Error("la imagen principal no existe en R2");
      const buf = Buffer.from(await res.arrayBuffer());
      if (!(await uploadVariants(item.key, buf))) throw new Error("no se pudieron subir las variantes");
      await markReady(item);
      done++;
      onItem?.(item, true);
    } catch (e) {
      failed++;
      onItem?.(item, false, e instanceof Error ? e.message : String(e));
    }
  }
  return { done, failed, remaining: Math.max(0, remaining - done) };
}
