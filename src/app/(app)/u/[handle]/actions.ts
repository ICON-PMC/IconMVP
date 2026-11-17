"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadImageField } from "@/lib/upload";
import { deleteFromR2 } from "@/lib/r2";
import { UserStorageQuotaError } from "@/lib/storage-quota";
import { normalizeUrl } from "@/lib/links";
import { isUuid } from "@/lib/look-rules";
import { PROFILE_LIMITS } from "@/lib/profile-rules";

// Acciones del perfil público (spec 009, contracts §2).

type Fail = { ok: false; error: string };

async function me() {
  const session = await getCurrentUser();
  return session?.profile ?? null;
}

function revalidateProfile(...handles: (string | null | undefined)[]) {
  for (const h of handles) if (h) revalidatePath(`/u/${h}`, "layout");
}

export async function checkHandle(handle: string): Promise<{ available: boolean; reason: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("handle_available", { p_handle: String(handle ?? "") });
  if (error) return { available: false, reason: "No pudimos revisar ese nombre. Intenta de nuevo." };
  return { available: data == null, reason: data ?? null };
}

export type ProfileFieldErrors = Partial<Record<"handle" | "display_name" | "bio" | "city" | "link_url" | "form", string>>;

export async function updateProfile(
  formData: FormData,
): Promise<{ ok: true; handle: string } | { ok: false; fieldErrors: ProfileFieldErrors }> {
  const profile = await me();
  if (!profile) return { ok: false, fieldErrors: { form: "Inicia sesión para editar tu perfil." } };

  const handle = String(formData.get("handle") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const linkRaw = String(formData.get("link_url") ?? "").trim();

  const errors: ProfileFieldErrors = {};
  if (displayName.length > PROFILE_LIMITS.displayName) errors.display_name = `Usa hasta ${PROFILE_LIMITS.displayName} caracteres.`;
  if (bio.length > PROFILE_LIMITS.bio) errors.bio = `Usa hasta ${PROFILE_LIMITS.bio} caracteres.`;
  if (city && !isUuid(city)) errors.city = "Elige una ciudad de la lista.";
  let link: string | null = null;
  if (linkRaw) {
    if (/^(javascript|data|vbscript|file):/i.test(linkRaw) || /^http:\/\//i.test(linkRaw)) {
      errors.link_url = "El enlace debe empezar por https://";
    } else {
      link = normalizeUrl(linkRaw);
      if (!link || !link.startsWith("https://")) errors.link_url = "Escribe un enlace válido que empiece por https://";
      else if (link.length > 300) errors.link_url = "Ese enlace es muy largo.";
    }
  }
  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };

  const supabase = await createClient();
  const oldHandle = profile.handle;
  let newHandle = oldHandle;
  if (handle && handle !== oldHandle) {
    const { data, error } = await supabase.rpc("set_my_handle", { p_handle: handle });
    if (error) return { ok: false, fieldErrors: { handle: error.message } };
    newHandle = data;
  }

  const { error } = await supabase
    .from("users")
    .update({ display_name: displayName || null, bio: bio || null, home_city_id: city || null, link_url: link })
    .eq("id", profile.id);
  if (error) {
    console.error("[profile] updateProfile falló:", error.message);
    return { ok: false, fieldErrors: { form: "No pudimos guardar tu perfil. Intenta de nuevo." } };
  }

  revalidateProfile(oldHandle, newHandle);
  revalidatePath("/settings");
  return { ok: true, handle: newHandle };
}

export async function uploadAvatar(formData: FormData): Promise<{ ok: true; avatar: string } | Fail> {
  const profile = await me();
  if (!profile) return { ok: false, error: "Inicia sesión para cambiar tu foto." };
  let img;
  try {
    img = await uploadImageField(formData, `users/${profile.id}/avatar`, "image", { enforceUserQuota: true, square: 512 });
  } catch (e) {
    if (e instanceof UserStorageQuotaError) return { ok: false, error: e.message };
    console.error("[profile] uploadAvatar falló:", e instanceof Error ? e.message : e);
    return { ok: false, error: "No pudimos subir la foto. Intenta con otra." };
  }
  if (!img) return { ok: false, error: "Elige una foto." };

  const supabase = await createClient();
  const old = profile.avatar_key;
  const { error } = await supabase.from("users").update({ avatar_key: img.key, avatar_bytes: img.bytes }).eq("id", profile.id);
  if (error) {
    await deleteFromR2([img.key]);
    return { ok: false, error: "No pudimos guardar la foto. Intenta de nuevo." };
  }
  if (old && old !== img.key) await deleteFromR2([old]);
  revalidateProfile(profile.handle);
  revalidatePath("/", "layout");
  return { ok: true, avatar: img.key };
}

export async function removeAvatar(): Promise<{ ok: true } | Fail> {
  const profile = await me();
  if (!profile) return { ok: false, error: "Inicia sesión." };
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ avatar_key: null, avatar_bytes: 0 }).eq("id", profile.id);
  if (error) return { ok: false, error: "No pudimos quitar la foto." };
  if (profile.avatar_key) await deleteFromR2([profile.avatar_key]);
  revalidateProfile(profile.handle);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function followUser(userId: string): Promise<{ ok: true } | (Fail & { needsLogin?: boolean })> {
  const profile = await me();
  if (!profile) return { ok: false, error: "Inicia sesión para seguir.", needsLogin: true };
  if (!isUuid(userId)) return { ok: false, error: "No puedes seguir esta cuenta." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_follows")
    .upsert({ follower_id: profile.id, followed_id: userId }, { onConflict: "follower_id,followed_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message.includes("No puedes") ? "No puedes seguir esta cuenta." : "No pudimos seguir esta cuenta." };
  revalidatePath("/siguiendo");
  return { ok: true };
}

export async function unfollowUser(userId: string): Promise<{ ok: true } | (Fail & { needsLogin?: boolean })> {
  const profile = await me();
  if (!profile) return { ok: false, error: "Inicia sesión.", needsLogin: true };
  if (!isUuid(userId)) return { ok: false, error: "Cuenta no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("user_follows").delete().eq("follower_id", profile.id).eq("followed_id", userId);
  if (error) return { ok: false, error: "No pudimos dejar de seguir esta cuenta." };
  revalidatePath("/siguiendo");
  return { ok: true };
}

export async function setPrivacy(input: { isPublic: boolean; showLikes: boolean }): Promise<{ ok: true } | Fail> {
  const profile = await me();
  if (!profile) return { ok: false, error: "Inicia sesión." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ is_public: Boolean(input.isPublic), show_likes: Boolean(input.showLikes) })
    .eq("id", profile.id);
  if (error) return { ok: false, error: "No pudimos guardar tu privacidad." };
  revalidateProfile(profile.handle);
  revalidatePath("/settings");
  return { ok: true };
}

export async function markProfileNoticeSeen(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_profile_notice_seen");
}
