"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

// Seguir / dejar de seguir una marca (Grupo 2 de specs/2026-09-22-user-social-actions).
//
// Devuelven un resultado en vez de redirigir porque las invoca un client component
// (FollowButton) que necesita saber si revertir el estado optimista. Sin sesión devuelven
// error (nunca 500); el botón anónimo es un enlace a /login, así que esto es defensa extra.
//
// Idempotentes: seguir una marca ya seguida o dejar de seguir una que no se seguía no es
// error — el estado final es el mismo. La PK compuesta (user_id, brand_id) impide duplicados.
//
// Revalidamos DOS rutas: la página de la marca (su server data `getMyFollowedBrandIds()`
// cambió, y si no se revalida el botón puede renderizar el `initialFollowing` viejo desde
// caché al volver a la página) y /saved (el tab "Siguiendo" lista estas marcas).

export type FollowResult = { ok: true } | { ok: false; error: string };

export async function followBrand(brandId: string, slug: string): Promise<FollowResult> {
  const session = await getCurrentUser();
  if (!session?.profile) return { ok: false, error: "Inicia sesión para seguir marcas." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_follows")
    .upsert(
      { user_id: session.profile.id, brand_id: brandId },
      { onConflict: "user_id,brand_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/marca/${slug}`);
  revalidatePath("/saved");
  return { ok: true };
}

export async function unfollowBrand(brandId: string, slug: string): Promise<FollowResult> {
  const session = await getCurrentUser();
  if (!session?.profile) return { ok: false, error: "Inicia sesión para seguir marcas." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_follows")
    .delete()
    .eq("user_id", session.profile.id)
    .eq("brand_id", brandId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/marca/${slug}`);
  revalidatePath("/saved");
  return { ok: true };
}
