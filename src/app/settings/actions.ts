"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function updateSettings(formData: FormData) {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/settings");

  const supabase = await createClient();
  const userId = session.profile.id;

  const displayName = String(formData.get("display_name") ?? "").trim();
  const city = formData.get("city") ? String(formData.get("city")) : null;
  const styleIds = formData.getAll("styles").map(String);

  await supabase
    .from("users")
    .update({ display_name: displayName || null, home_city_id: city })
    .eq("id", userId);

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
