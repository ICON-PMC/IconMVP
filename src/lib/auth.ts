import { cookies } from "next/headers";
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

export type MyBrand = Tables<"brands">;

// La marca que posee el usuario actual (o null si no tiene ninguna vinculada).
export async function getMyBrand(): Promise<MyBrand | null> {
  const session = await getCurrentUser();
  if (!session?.profile) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("owner_user_id", session.profile.id)
    .maybeSingle();
  return data;
}

// Cookie con la marca que el staff está gestionando desde /admin ("Gestionar"). De sesión,
// httpOnly. Solo se respeta para staff: para cualquier otro usuario se ignora.
export const MANAGED_BRAND_COOKIE = "icon_admin_brand";

export type PanelContext = {
  profile: Profile;
  brand: MyBrand | null;
  /** El staff está gestionando una marca ajena: no se bloquea por cuota (el peso sí cuenta). */
  actingAsStaff: boolean;
};

// Exige sesión y devuelve la marca del panel: la propia, o la que el staff eligió gestionar.
// No exige `role === "brand"` porque la propiedad real la determina `brands.owner_user_id`
// (la RLS de la base usa lo mismo vía `is_brand_owner()`); el rol es solo para la UI.
//
// Con staff la RLS deja tocar cualquier marca, así que las acciones del panel deben filtrar
// siempre por `brand.id` (no confiar solo en la RLS).
export async function requireBrandOwner(): Promise<PanelContext> {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/marca/panel");

  if (isStaff(session.profile)) {
    const managedId = (await cookies()).get(MANAGED_BRAND_COOKIE)?.value;
    if (managedId) {
      const supabase = await createClient();
      const { data: managed } = await supabase
        .from("brands")
        .select("*")
        .eq("id", managedId)
        .maybeSingle();
      if (managed) return { profile: session.profile, brand: managed, actingAsStaff: true };
    }
  }
  return { profile: session.profile, brand: await getMyBrand(), actingAsStaff: false };
}

/** Marca a la que se le exige cuota al subir: ninguna si el staff está gestionando. */
export function quotaBrandId(ctx: { brand: MyBrand | null; actingAsStaff: boolean }): string | undefined {
  return ctx.actingAsStaff ? undefined : ctx.brand?.id;
}
