"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function toggleSavedPost(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const path = String(formData.get("path") ?? "/feed");

  const session = await getCurrentUser();
  if (!session?.profile) redirect(`/login?next=${encodeURIComponent(path)}`);

  const supabase = await createClient();
  const userId = session.profile.id;

  const { data: existing } = await supabase
    .from("saved_posts")
    .select("post_id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing) {
    await supabase.from("saved_posts").delete().eq("user_id", userId).eq("post_id", postId);
  } else {
    await supabase.from("saved_posts").insert({ user_id: userId, post_id: postId });
  }

  revalidatePath(path);
}

export async function toggleSavedGarment(formData: FormData) {
  const garmentId = String(formData.get("garmentId") ?? "");
  const sourcePostId = formData.get("sourcePostId")
    ? String(formData.get("sourcePostId"))
    : null;
  const path = String(formData.get("path") ?? "/feed");

  const session = await getCurrentUser();
  if (!session?.profile) redirect(`/login?next=${encodeURIComponent(path)}`);

  const supabase = await createClient();
  const userId = session.profile.id;

  const { data: existing } = await supabase
    .from("saved_garments")
    .select("garment_id")
    .eq("user_id", userId)
    .eq("garment_id", garmentId)
    .maybeSingle();

  if (existing) {
    await supabase.from("saved_garments").delete().eq("user_id", userId).eq("garment_id", garmentId);
  } else {
    await supabase
      .from("saved_garments")
      .insert({ user_id: userId, garment_id: garmentId, source_post_id: sourcePostId });
  }

  revalidatePath(path);
}
