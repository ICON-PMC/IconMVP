import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { FollowList } from "@/components/profile/follow-list";
import { getCurrentUser } from "@/lib/auth";
import { getMyFollowing } from "@/lib/profile";

export const metadata: Metadata = { title: "Personas y marcas que sigues · Icon", robots: { index: false } };

// Lista privada de lo que sigo (spec 009, FR-021). Solo la ve la persona.
export default async function FollowingPage() {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/siguiendo");
  const rows = await getMyFollowing();
  const me = session.profile;
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-5">
      <PageHeader
        title="Personas y marcas que sigues"
        subtitle="Solo tú ves esta lista."
        back={me.role !== "brand" ? { href: `/u/${me.handle}`, label: "Volver a tu perfil" } : undefined}
      />
      {rows.length ? (
        <section className="surface px-5 md:px-6">
          <FollowList rows={rows} following loginNext="/siguiendo" />
        </section>
      ) : (
        <EmptyState
          icon={UsersIcon}
          title="Aún no sigues a nadie"
          description="Sigue marcas y personas para ver lo que publican en la pestaña Siguiendo del feed."
          action={{ label: "Ir a Siguiendo", href: "/feed?ver=siguiendo" }}
        />
      )}
    </div>
  );
}
