import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { getCurrentUser } from "@/lib/auth";
import { getCityOptions } from "@/lib/cities";
import { createClient } from "@/lib/supabase/server";
import { EditProfileForm } from "./edit-profile-form";

export const metadata: Metadata = { title: "Editar perfil · Icon", robots: { index: false } };

export default async function EditProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const session = await getCurrentUser();
  if (!session?.profile) redirect(`/login?next=${encodeURIComponent(`/u/${handle}/editar`)}`);
  const me = session.profile;
  // Solo el dueño; para cualquier otra persona, la misma respuesta que un perfil inexistente.
  if (decodeURIComponent(handle).toLowerCase() !== me.handle) notFound();

  const cities = await getCityOptions(await createClient());
  const name = me.display_name?.trim() || me.handle;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-5">
      <PageHeader title="Editar perfil" back={{ href: `/u/${me.handle}`, label: "Volver a tu perfil" }} />
      <section className="surface mt-4 p-5 md:p-6">
        <h2 className="mb-4 text-h3 text-text">Foto</h2>
        <AvatarUploader avatar={me.avatar_key} name={name} seed={me.id} />
      </section>
      <EditProfileForm
        cities={cities}
        initial={{
          handle: me.handle,
          displayName: me.display_name ?? "",
          bio: me.bio ?? "",
          city: me.home_city_id,
          linkUrl: me.link_url ?? "",
        }}
      />
    </div>
  );
}
