import { createClient } from "@/lib/supabase/server";

// Identidad pública de usuarios (spec 008). Se lee SIEMPRE de la vista `public_profiles`, nunca de
// `users`: la vista solo expone columnas seguras (sin correo, auth_id ni rol).

export type PublicProfile = {
  id: string;
  handle: string;
  displayName: string;
  avatar: string | null;
  isPublic: boolean;
  likesVisible: boolean;
};

export async function getPublicProfiles(ids: string[]): Promise<Map<string, PublicProfile>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, PublicProfile>();
  if (!unique.length) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_profiles")
    .select("id, handle, display_name, avatar_key, is_public, likes_visible")
    .in("id", unique);
  for (const p of data ?? []) {
    map.set(p.id, {
      id: p.id,
      handle: p.handle,
      displayName: p.display_name,
      avatar: p.avatar_key,
      isPublic: p.is_public,
      likesVisible: p.likes_visible,
    });
  }
  return map;
}
