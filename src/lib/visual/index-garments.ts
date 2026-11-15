// Indexación del catálogo para la búsqueda por foto (spec 005, FR-016 a FR-018).
// Calcula la huella visual de la foto principal de las prendas marcadas como `pending` y la guarda.
// Lo usan: las acciones que publican o cambian la foto (con `after()`), la ruta del cron y el
// script `npm run db:embed`. Necesita un cliente con service role (escribe garment_embeddings).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { imageUrl } from "@/lib/images";
import { embedImage, toPgVector } from "./embed";
import { VISUAL_MODEL } from "./model";

type Admin = SupabaseClient<Database>;
const MAX_ATTEMPTS = 5;

/** Marca como pendientes las prendas publicadas cuya foto principal no tiene huella al día. */
export async function markPending(supabase: Admin, garmentIds?: string[]): Promise<number> {
  // Los tipos escritos a mano no declaran relaciones: tres consultas simples en vez de un embed.
  let q = supabase.from("garments").select("id").eq("status", "published");
  if (garmentIds?.length) q = q.in("id", garmentIds);
  const { data: garments, error } = await q;
  if (error) throw new Error(error.message);
  const ids = (garments ?? []).map((g) => g.id);
  if (!ids.length) return 0;

  const mainImage = new Map<string, { key: string; position: number }>();
  const existing = new Map<string, { image_key: string; status: string; model: string }>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const [{ data: imgs }, { data: embs }] = await Promise.all([
      supabase.from("garment_images").select("garment_id, cf_image_id, position").in("garment_id", chunk),
      supabase.from("garment_embeddings").select("garment_id, image_key, status, model").in("garment_id", chunk),
    ]);
    for (const im of imgs ?? []) {
      const cur = mainImage.get(im.garment_id);
      if (!cur || im.position < cur.position) mainImage.set(im.garment_id, { key: im.cf_image_id, position: im.position });
    }
    for (const e of embs ?? []) existing.set(e.garment_id, e);
  }

  const rows = ids.flatMap((id) => {
    const img = mainImage.get(id);
    if (!img) return [];
    const emb = existing.get(id);
    const upToDate = emb && emb.image_key === img.key && emb.model === VISUAL_MODEL && emb.status !== "failed";
    if (upToDate && !garmentIds?.length) return [];
    return [{ garment_id: id, image_key: img.key, model: VISUAL_MODEL, status: "pending" as const, attempts: 0, error: null }];
  });
  if (!rows.length) return 0;
  const { error: upErr } = await supabase.from("garment_embeddings").upsert(rows, { onConflict: "garment_id" });
  if (upErr) throw new Error(upErr.message);
  return rows.length;
}

export type ProcessResult = { processed: number; ready: number; failed: number };

/** Procesa hasta `limit` prendas pendientes (o las indicadas). */
export async function processPending(
  supabase: Admin,
  { limit = 25, garmentIds }: { limit?: number; garmentIds?: string[] } = {},
): Promise<ProcessResult> {
  if (garmentIds?.length) await markPending(supabase, garmentIds);
  let q = supabase
    .from("garment_embeddings")
    .select("garment_id, image_key, attempts")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("updated_at")
    .limit(limit);
  if (garmentIds?.length) q = q.in("garment_id", garmentIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const result: ProcessResult = { processed: 0, ready: 0, failed: 0 };
  for (const row of data ?? []) {
    result.processed++;
    try {
      const url = imageUrl(row.image_key);
      if (!url) throw new Error("Sin URL pública de la imagen.");
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Imagen no disponible (${res.status}).`);
      const vec = await embedImage(Buffer.from(await res.arrayBuffer()));
      const { error: upErr } = await supabase
        .from("garment_embeddings")
        .update({ embedding: toPgVector(vec), status: "ready", error: null, model: VISUAL_MODEL, updated_at: new Date().toISOString() })
        .eq("garment_id", row.garment_id)
        .eq("image_key", row.image_key); // si la foto cambió mientras tanto, queda pendiente
      if (upErr) throw new Error(upErr.message);
      result.ready++;
    } catch (e) {
      result.failed++;
      const attempts = row.attempts + 1;
      await supabase
        .from("garment_embeddings")
        .update({
          attempts,
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          error: e instanceof Error ? e.message.slice(0, 500) : String(e),
          updated_at: new Date().toISOString(),
        })
        .eq("garment_id", row.garment_id);
    }
  }
  return result;
}
