"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

// Dar like / quitar like a un post (Grupo 3 de specs/2026-09-22-user-social-actions).
//
// Devuelven un resultado en vez de redirigir porque las invoca un client component
// (LikeButton) que necesita saber si revertir el estado optimista. Sin sesión devuelven
// error (nunca 500); el botón anónimo es un enlace a /login, así que esto es defensa extra.
//
// Idempotentes: dar like a un post ya likeado o quitarlo cuando no había like no es error —
// el estado final es el mismo. La PK compuesta (user_id, post_id) impide duplicados.
//
// El like NO toca posts.popularity ni el orden del feed (decisión 6); solo cambia el
// contador `like_count` que ya expone la vista post_feed.
//
// Revalidamos la ruta desde la que se actuó (`path`, la pasa el botón) y /saved, porque las
// tarjetas del tab "Guardados" también muestran el contador.

export type LikeResult = { ok: true } | { ok: false; error: string };

export async function likePost(postId: string, path: string): Promise<LikeResult> {
  const session = await getCurrentUser();
  if (!session?.profile) return { ok: false, error: "Inicia sesión para dar like." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("post_likes")
    .upsert(
      { user_id: session.profile.id, post_id: postId },
      { onConflict: "user_id,post_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath(path);
  revalidatePath("/saved");
  return { ok: true };
}

export async function unlikePost(postId: string, path: string): Promise<LikeResult> {
  const session = await getCurrentUser();
  if (!session?.profile) return { ok: false, error: "Inicia sesión para dar like." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("post_likes")
    .delete()
    .eq("user_id", session.profile.id)
    .eq("post_id", postId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(path);
  revalidatePath("/saved");
  return { ok: true };
}
