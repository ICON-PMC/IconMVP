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
  redirect("/feed");
}
