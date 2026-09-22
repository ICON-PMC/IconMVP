"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { LikeResult } from "@/app/post/[id]/actions";

// Dar like / quitar like a una prenda (espejo de post/[id]/actions.ts).
//
// Devuelven un resultado en vez de redirigir porque las invoca un client component
// (LikeButton) que necesita saber si revertir el estado optimista. Sin sesión devuelven
// error (nunca 500); el botón anónimo es un enlace a /login, así que esto es defensa extra.
//
// Idempotentes: dar like a una prenda ya likeada o quitarlo cuando no había like no es
// error — la PK compuesta (user_id, garment_id) impide duplicados.
//
// El like NO toca `garments.popularity` ni el orden del feed (decisión 6); solo cambia el
// contador `like_count` que expone la vista feed_items.
//
// Revalidamos la ruta desde la que se actuó (`path`, la pasa el botón) y /saved, porque las
// tarjetas del tab "Guardados" también muestran el contador.

export async function likeGarment(garmentId: string, path: string): Promise<LikeResult> {
  const session = await getCurrentUser();
  if (!session?.profile) return { ok: false, error: "Inicia sesión para dar like." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("garment_likes")
    .upsert(
      { user_id: session.profile.id, garment_id: garmentId },
      { onConflict: "user_id,garment_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath(path);
  revalidatePath("/saved");
  return { ok: true };
}

export async function unlikeGarment(garmentId: string, path: string): Promise<LikeResult> {
  const session = await getCurrentUser();
  if (!session?.profile) return { ok: false, error: "Inicia sesión para dar like." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("garment_likes")
    .delete()
    .eq("user_id", session.profile.id)
    .eq("garment_id", garmentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(path);
  revalidatePath("/saved");
  return { ok: true };
}
