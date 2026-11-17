import { TopBar } from "@/components/nav/top-bar";
import { getCurrentUser } from "@/lib/auth";
import { userLooksEnabled } from "@/lib/features";
import type { NavContext, NavRole } from "@/lib/nav";

// Encabezado de las pantallas fuera del grupo (app) (paneles de marca y del equipo): la misma barra
// superior del sistema nuevo (spec 007). Las rutas públicas la reciben del layout de (app).
export async function SiteHeader() {
  const session = await getCurrentUser();
  const profile = session?.profile ?? null;
  const ctx: NavContext = {
    isLoggedIn: Boolean(profile),
    role: (profile?.role ?? null) as NavRole,
    handle: profile && profile.role !== "brand" ? profile.handle : null,
    avatar: profile?.avatar_key ?? null,
    displayName: profile?.display_name || profile?.handle || session?.email || null,
    seed: profile?.id ?? "anon",
    userLooks: userLooksEnabled(),
  };
  return <TopBar ctx={ctx} />;
}
