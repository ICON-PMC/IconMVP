// /api/embeddings/process — procesa huellas visuales pendientes (spec 005, FR-016/018).
// Lo llama el Vercel Cron (GET con Authorization: Bearer CRON_SECRET) y el botón "Reintentar"
// de /admin (POST con sesión de staff). También aplica la retención de 180 días de photo_searches
// y completa las variantes de imagen que fallaron al subir (spec 006).
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { processPendingVariants } from "@/lib/image-variants";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteFromR2 } from "@/lib/r2";
import { markPending, processPending } from "@/lib/visual/index-garments";

export const runtime = "nodejs";
export const maxDuration = 60;

async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const session = await getCurrentUser();
  return isStaff(session?.profile);
}

async function run(garmentIds?: string[], all = false) {
  const admin = createAdminClient();
  if (all) await markPending(admin);
  if (garmentIds?.length) {
    await admin.from("garment_embeddings").update({ status: "pending", attempts: 0 }).in("garment_id", garmentIds);
  }
  const result = await processPending(admin, { limit: 25, garmentIds });
  const cutoff = new Date(Date.now() - 180 * 86_400_000).toISOString();
  await admin.from("photo_searches").delete().lt("created_at", cutoff);
  const variants = await processPendingVariants(20).catch((e) => ({
    done: 0,
    failed: 0,
    remaining: -1,
    error: e instanceof Error ? e.message : String(e),
  }));
  const drafts = await cleanStaleDrafts(admin).catch((e) => ({
    deleted: 0,
    error: e instanceof Error ? e.message : String(e),
  }));
  return { ...result, variants, drafts };
}

// Spec 008 (R13): borradores de looks de usuarios sin cambios en 30 días, con sus fotos.
async function cleanStaleDrafts(admin: ReturnType<typeof createAdminClient>): Promise<{ deleted: number }> {
  const { data, error } = await admin.rpc("stale_user_drafts", { p_days: 30 });
  if (error) throw new Error(error.message);
  const postIds = [...new Set((data ?? []).map((r) => r.post_id))];
  if (!postIds.length) return { deleted: 0 };
  const keys = (data ?? []).map((r) => r.image_key);
  const { error: delErr } = await admin.from("posts").delete().in("id", postIds).eq("status", "draft").eq("author_type", "user");
  if (delErr) throw new Error(delErr.message);
  await deleteFromR2(keys);
  return { deleted: postIds.length };
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { garmentIds?: string[]; all?: boolean };
  const ids = Array.isArray(body.garmentIds) ? body.garmentIds.filter((x) => typeof x === "string").slice(0, 100) : undefined;
  return NextResponse.json(await run(ids, Boolean(body.all)));
}
