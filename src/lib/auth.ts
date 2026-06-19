import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"users">;

export type SessionUser = {
  authUserId: string;
  email: string | null;
  profile: Profile | null;
};

// Usuario autenticado actual + su perfil (con rol) desde public.users.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", user.id)
    .maybeSingle();

  return { authUserId: user.id, email: user.email ?? null, profile };
}

// ¿El usuario es del equipo (carga contenido)?
export function isStaff(
  profile: Pick<Profile, "role"> | null | undefined,
): boolean {
  return profile?.role === "curator" || profile?.role === "admin";
}

// Exige sesión de staff o redirige a "/". Devuelve el perfil para usar created_by, etc.
export async function requireStaff(): Promise<Profile> {
  const session = await getCurrentUser();
  if (!session?.profile || !isStaff(session.profile)) redirect("/");
  return session.profile;
}
