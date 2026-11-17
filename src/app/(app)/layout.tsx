import { Suspense } from "react";
import { BottomNav } from "@/components/nav/bottom-nav";
import { TopBar } from "@/components/nav/top-bar";
import { ProfileNotice } from "@/components/profile/profile-notice";
import { getCurrentUser } from "@/lib/auth";
import { userLooksEnabled } from "@/lib/features";
import type { NavContext, NavRole } from "@/lib/nav";

// Rutas públicas de la app (spec 007, US2): barra superior y barra inferior (móvil) una sola vez.
// Quedan fuera del grupo: landing, login, registro, onboarding y los paneles.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar ctx={ctx} />
      {profile && profile.role !== "brand" && !profile.profile_notice_seen_at && <ProfileNotice handle={profile.handle} showLikes={profile.show_likes} />}
      <div className="flex-1 pb-safe-nav md:pb-0">{children}</div>
      {/* useSearchParams en la barra: Suspense evita que toda la ruta pase a render en cliente. */}
      <Suspense>
        <BottomNav ctx={ctx} />
      </Suspense>
    </div>
  );
}
