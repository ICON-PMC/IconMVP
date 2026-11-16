// /api/embeddings/process — procesa huellas visuales pendientes (spec 005, FR-016/018).
// Lo llama el Vercel Cron (GET con Authorization: Bearer CRON_SECRET) y el botón "Reintentar"
// de /admin (POST con sesión de staff). También aplica la retención de 180 días de photo_searches
// y completa las variantes de imagen que fallaron al subir (spec 006).
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { processPendingVariants } from "@/lib/image-variants";
import { createAdminClient } from "@/lib/supabase/admin";
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
  return { ...result, variants };
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
