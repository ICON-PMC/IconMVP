import { redirect } from "next/navigation";
import { DeleteAccountSection } from "./delete-account-section";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyBrand } from "@/lib/auth";
import { ChipSelect } from "@/components/chip-select";
import { SubmitButton } from "@/components/submit-button";
import { updateSettings } from "./actions";
import { PrivacySection } from "./privacy-section";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ChevronRightIcon } from "lucide-react";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/settings");
  const { ok } = await searchParams;

  const supabase = await createClient();
  const userId = session.profile.id;
  const [{ data: styles }, { data: prefs }] = await Promise.all([
    supabase.from("tags").select("id, name").eq("type", "style").order("name"),
    supabase.from("user_preferences").select("tag_id").eq("user_id", userId),
  ]);
  const myStyles = new Set((prefs ?? []).map((p) => p.tag_id));
  const me = session.profile;
  const myName = me.display_name?.trim() || me.handle;
  const myBrand = await getMyBrand();

  // Ajustes (spec 007, US5): secciones en tarjetas, campos y chips del sistema.
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-5">
      <h1 className="mt-2 text-h1 text-text">Ajustes</h1>
      <p className="mt-1 text-sm text-text-muted">{session.email}</p>

      {ok && (
        <p role="status" className="mt-4 rounded-[var(--radius-field)] bg-surface-sunken px-3.5 py-2.5 text-sm font-medium text-text">
          ✓ Cambios guardados.
        </p>
      )}

      {/* Nombre, foto, bio, ciudad y enlace se editan en un solo lugar: el perfil (spec 009). */}
      <Link
        href={`/u/${me.handle}/editar`}
        className="surface mt-6 flex items-center gap-4 p-5 transition-colors hover:bg-surface-sunken md:p-6"
      >
        <Avatar image={me.avatar_key} name={myName} seed={me.id} size={48} />
        <span className="min-w-0 flex-1">
          <span className="block text-h3 text-text">Editar perfil</span>
          <span className="block truncate text-sm text-text-muted">
            @{me.handle} · nombre, foto, bio, ciudad y enlace
          </span>
        </span>
        <ChevronRightIcon className="size-5 text-text-muted" aria-hidden />
      </Link>

      <PrivacySection isPublic={me.is_public} showLikes={me.show_likes} />

      <section className="surface mt-6 p-5 md:p-6">
        <h2 className="mb-4 text-h3 text-text">Tus estilos</h2>
        <form action={updateSettings} className="flex flex-col gap-5">
          <ChipSelect
            name="styles"
            legend="Elige los que más van contigo"
            options={styles ?? []}
            defaultSelected={[...myStyles]}
          />
          <SubmitButton pendingText="Guardando…" className="w-full sm:w-fit">
            Guardar cambios
          </SubmitButton>
        </form>
      </section>

      {/* En móvil no hay menú de cuenta en la barra superior: salir vive aquí (spec 007). */}
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="secondary" className="w-full sm:w-auto">
          Cerrar sesión
        </Button>
      </form>
      <DeleteAccountSection brandName={myBrand?.name ?? null} />
    </div>
  );
}
