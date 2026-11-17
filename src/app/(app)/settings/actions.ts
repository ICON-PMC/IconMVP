"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { imageKeysFor } from "@/lib/image-keys";
import { deleteFromR2 } from "@/lib/r2";

export async function updateSettings(formData: FormData) {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/settings");

  const supabase = await createClient();
  const userId = session.profile.id;

  // Nombre y ciudad se editan en el perfil (spec 009); aquí solo los estilos preferidos.
  const styleIds = formData.getAll("styles").map(String);

  // Reemplaza las preferencias de estilo.
  await supabase.from("user_preferences").delete().eq("user_id", userId);
  if (styleIds.length) {
    await supabase
      .from("user_preferences")
      .insert(styleIds.map((tag_id) => ({ user_id: userId, tag_id })));
  }

  revalidatePath("/", "layout");
  redirect("/settings?ok=1");
}

// Borra la cuenta: su marca con todo (si tiene), sus imágenes de R2 y el login en Supabase Auth
// (RPC `delete_my_account`; la cascada de auth.users se lleva public.users y lo suyo).
export async function deleteMyAccount(confirm: string): Promise<{ ok: false; error: string } | void> {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/settings");
  if (confirm.trim().toUpperCase() !== "ELIMINAR")
    return { ok: false, error: "Escribe ELIMINAR para confirmar." };

  const supabase = await createClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id")
    .eq("owner_user_id", session.profile.id);
  // Fotos de sus marcas y, desde la spec 008, de sus looks y su foto de perfil. Se leen antes de
  // borrar (la cascada se lleva las filas) y se borran de R2 si el borrado salió bien.
  const keys = (
    await Promise.all([
      ...(brands ?? []).map((b) => imageKeysFor(supabase, { brandId: b.id })),
      imageKeysFor(supabase, { userId: session.profile.id }),
    ])
  ).flat();

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, error: error.message };
  await deleteFromR2(keys);
  // El usuario ya no existe: cerrar la sesión limpia las cookies (puede fallar sin importar).
  await supabase.auth.signOut().catch(() => undefined);
  revalidatePath("/", "layout");
  redirect("/feed?ok=cuenta-eliminada");
}
