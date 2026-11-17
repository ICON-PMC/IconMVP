"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/look-rules";
import { RATING_BODY } from "@/lib/rating-rules";

// Escribir, editar y borrar la reseña propia de una marca (spec 011, contracts §2). Las reglas
// (marca activa, no la propia, límite diario, bloqueo) las aplica la base con mensajes en español.

type Result = { ok: true } | { ok: false; error: string; field?: "stars" | "body" };

async function revalidateBrand(brandId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("brands").select("slug").eq("id", brandId).maybeSingle();
  if (data) revalidatePath(`/marca/${data.slug}`);
  revalidatePath("/marca/panel");
}

export async function saveRating(brandId: string, input: { stars: number; body: string }): Promise<Result> {
  const session = await getCurrentUser();
  if (!session?.profile) return { ok: false, error: "Inicia sesión para escribir una reseña." };
  if (!isUuid(brandId)) return { ok: false, error: "Marca no válida." };
  const stars = Math.round(Number(input.stars));
  const body = String(input.body ?? "").trim();
  if (!(stars >= 1 && stars <= 5)) return { ok: false, error: "Elige de 1 a 5 estrellas.", field: "stars" };
  if (body.length < RATING_BODY.min) return { ok: false, error: `Escribe al menos ${RATING_BODY.min} caracteres.`, field: "body" };
  if (body.length > RATING_BODY.max) return { ok: false, error: `Usa hasta ${RATING_BODY.max} caracteres.`, field: "body" };

  const supabase = await createClient();
  const me = session.profile.id;
  const { data: existing } = await supabase.from("brand_ratings").select("id").eq("brand_id", brandId).eq("user_id", me).maybeSingle();
  const { error } = existing
    ? await supabase.from("brand_ratings").update({ stars, body }).eq("id", existing.id)
    : await supabase.from("brand_ratings").insert({ brand_id: brandId, user_id: me, stars, body });
  if (error) {
    // Los mensajes de la regla vienen en español desde el trigger; el resto, genérico.
    const msg = error.code === "P0001" || /[áéíóúñ]/i.test(error.message) ? error.message : "No pudimos guardar tu reseña. Intenta de nuevo.";
    return { ok: false, error: msg };
  }
  await revalidateBrand(brandId);
  return { ok: true };
}

export async function deleteRating(brandId: string): Promise<Result> {
  const session = await getCurrentUser();
  if (!session?.profile) return { ok: false, error: "Inicia sesión." };
  if (!isUuid(brandId)) return { ok: false, error: "Marca no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("brand_ratings").delete().eq("brand_id", brandId).eq("user_id", session.profile.id);
  if (error) return { ok: false, error: "No pudimos borrar tu reseña." };
  await revalidateBrand(brandId);
  return { ok: true };
}

/** Siguiente tanda de reseñas (lista con "Ver más"). */
export async function loadMoreRatings(brandId: string, sort: "recent" | "high" | "low", stars: number | null, offset: number) {
  const { getRatings } = await import("@/lib/ratings");
  if (!isUuid(brandId)) return { items: [], nextOffset: null };
  return getRatings(brandId, { sort, stars: stars ?? undefined, offset: Math.max(0, offset) });
}
