// POST /api/visual/search — búsqueda por foto (spec 005, contrato en contracts/interfaces.md).
// Recibe la foto (ya reducida/recortada en el cliente) o un vector previo, y devuelve prendas
// parecidas con los filtros del feed. La foto NUNCA se escribe a disco ni a R2 (FR-012).
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { parseFeedParams, type FeedItem } from "@/lib/feed";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedImage, normalize, toPgVector } from "@/lib/visual/embed";
import { EMBEDDING_DIM } from "@/lib/visual/model";
import { detectCategory, isBlocked, looksLikeNoClothing } from "@/lib/visual/classify";
import { SIMILAR_MIN } from "@/lib/visual/thresholds";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 2 * 1024 * 1024;
const PER_HOUR = 30;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

function requesterKey(req: NextRequest, userId: string | null): string {
  if (userId) return `user:${userId}`;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "0.0.0.0";
  const salt = `${process.env.CRON_SECRET ?? "icon"}:${new Date().toISOString().slice(0, 10)}`;
  return "ip:" + createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

async function monthlyCapReached(admin: ReturnType<typeof createAdminClient>): Promise<boolean> {
  const cap = Number(process.env.PHOTO_SEARCH_MONTHLY_CAP ?? 0);
  if (!cap) return false;
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("photo_searches")
    .select("id", { count: "exact", head: true })
    .eq("kind", "photo")
    .gte("created_at", start.toISOString());
  return (count ?? 0) >= cap;
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const session = await getCurrentUser();
  const userId = session?.profile?.id ?? null;
  // Solo personas con cuenta (decisión de la dueña, 2026-11-15).
  if (!userId) return err(401, "Inicia sesión para buscar por foto.");
  const key = requesterKey(req, userId);
  const { filters } = parseFeedParams(Object.fromEntries(req.nextUrl.searchParams));

  // 1. Vector: de una foto nueva, o el que el cliente ya tenía (re-búsqueda con filtros, FR-009).
  let vec: Float32Array;
  let isNewPhoto = false;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { embedding?: unknown };
      const arr = Array.isArray(body.embedding) ? body.embedding.map(Number) : [];
      if (arr.length !== EMBEDDING_DIM || arr.some((x) => !Number.isFinite(x)))
        return err(400, "La búsqueda no es válida. Vuelve a subir la foto.");
      vec = normalize(Float32Array.from(arr));
    } else {
      const form = await req.formData();
      const file = form.get("image");
      if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES || (file.type && !TYPES.has(file.type)))
        return err(400, "Sube una imagen JPG, PNG o WebP de hasta 2 MB.");

      if ((await admin.rpc("photo_search_quota", { p_requester: key })).data! >= PER_HOUR)
        return err(429, "Hiciste muchas búsquedas por foto. Intenta en un rato.");
      if (await monthlyCapReached(admin)) return err(503, "La búsqueda por foto no está disponible por ahora.");

      vec = await embedImage(Buffer.from(await file.arrayBuffer()));
      isNewPhoto = true;
      if (isBlocked(vec) || looksLikeNoClothing(vec))
        return err(422, "No encontramos ropa en la foto. Prueba con otra o recórtala.");
    }
  } catch (e) {
    console.error("[visual/search] error al procesar la foto:", e);
    return err(503, "La búsqueda por foto no está disponible por ahora.");
  }

  // 2. Vecinos sin filtros para detectar la categoría (voto), luego la búsqueda con filtros.
  const pgVec = toPgVector(vec);
  const { data: probe } = await admin.rpc("search_by_embedding", { p_embedding: pgVec, p_limit: 10 });
  const probeIds = (probe ?? []).map((r) => r.id);
  const { data: probeCats } = probeIds.length
    ? await admin.from("feed_items").select("id, categories").in("id", probeIds)
    : { data: [] as { id: string; categories: string[] }[] };
  const catById = new Map((probeCats ?? []).map((r) => [r.id, r.categories?.[0]]));
  const category = detectCategory(vec, probeIds.map((id) => catById.get(id)));

  const { data: hits, error } = await admin.rpc("search_by_embedding", {
    p_embedding: pgVec,
    p_limit: 48,
    p_cities: filters.city.length ? filters.city : null,
    p_occasions: filters.occasion.length ? filters.occasion : null,
    p_styles: filters.style.length ? filters.style : null,
    p_categories: filters.category.length ? filters.category : null,
    p_prices: filters.price.length ? filters.price : null,
    p_colors: filters.color.length ? filters.color : null,
    p_prefer_category: category,
  });
  if (error) {
    console.error("[visual/search] search_by_embedding falló:", error.message);
    return err(503, "La búsqueda por foto no está disponible por ahora.");
  }

  const ids = (hits ?? []).map((h) => h.id);
  const { data: rows } = ids.length
    ? await admin.from("feed_items").select("*").eq("kind", "garment").in("id", ids)
    : { data: [] as FeedItem[] };
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const items = (hits ?? []).flatMap((h) => {
    const row = byId.get(h.id);
    return row ? [{ ...row, similarity: h.similarity }] : [];
  });
  const top = items[0]?.similarity ?? null;
  const belowThreshold = top == null || top < SIMILAR_MIN;

  // 3. Registro sin imagen: solo la primera búsqueda de cada foto cuenta para el límite.
  if (isNewPhoto) {
    await admin.from("photo_searches").insert({
      kind: "photo",
      requester_key: key,
      user_id: userId,
      detected_category: category,
      top_similarity: top,
      results: items.length,
      below_threshold: belowThreshold,
    });
  }

  return NextResponse.json({
    embedding: Array.from(vec, (x) => Number(x.toFixed(6))),
    detectedCategory: category,
    belowThreshold,
    items,
  });
}
