"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function completeOnboarding(formData: FormData) {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/onboarding");

  const supabase = await createClient();
  const userId = session.profile.id;
  const skip = formData.get("skip");

  if (skip) {
    await supabase.from("users").update({ onboarded: true }).eq("id", userId);
  } else {
    const styleIds = formData.getAll("styles").map(String);
    const city = formData.get("city") ? String(formData.get("city")) : null;

    // Reemplaza las preferencias previas.
    await supabase.from("user_preferences").delete().eq("user_id", userId);
    if (styleIds.length) {
      await supabase
        .from("user_preferences")
        .insert(styleIds.map((tag_id) => ({ user_id: userId, tag_id })));
    }
    await supabase
      .from("users")
      .update({ home_city_id: city, onboarded: true })
      .eq("id", userId);
  }

  revalidatePath("/", "layout");
  // Paso final opcional: nombre de usuario y foto (spec 009, FR-017). Las cuentas de marca no tienen perfil.
  redirect(session.profile.role === "brand" ? "/feed" : "/onboarding?paso=perfil");
}

// Guarda el nombre de usuario elegido en el onboarding (la foto se sube aparte, al elegirla).
export async function saveOnboardingProfile(formData: FormData) {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/onboarding");
  const handle = String(formData.get("handle") ?? "").trim().toLowerCase();
  if (handle && handle !== session.profile.handle) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_my_handle", { p_handle: handle });
    if (error) redirect(`/onboarding?paso=perfil&error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/", "layout");
  redirect("/feed");
}
