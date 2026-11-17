import { redirect } from "next/navigation";
import { DeleteAccountSection } from "./delete-account-section";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { CityCombobox } from "@/components/city-combobox";
import { getCityOptions } from "@/lib/cities";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyBrand } from "@/lib/auth";
import { ChipSelect } from "@/components/chip-select";
import { FormField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { updateSettings } from "./actions";

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
  const [{ data: styles }, cities, { data: prefs }] = await Promise.all([
    supabase.from("tags").select("id, name").eq("type", "style").order("name"),
    getCityOptions(supabase),
    supabase.from("user_preferences").select("tag_id").eq("user_id", userId),
  ]);
  const myStyles = new Set((prefs ?? []).map((p) => p.tag_id));
  const myCity = session.profile.home_city_id;
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

      <section className="surface mt-6 p-5 md:p-6">
        <h2 className="mb-4 text-h3 text-text">Tu perfil</h2>
        <form action={updateSettings} className="flex flex-col gap-5">
          <FormField label="Nombre" htmlFor="display_name">
            <Input id="display_name" name="display_name" defaultValue={session.profile.display_name ?? ""} placeholder="Tu nombre" />
          </FormField>
          <FormField label="Tu ciudad" htmlFor="city">
            <CityCombobox id="city" name="city" options={cities} defaultValue={myCity} />
          </FormField>
          <ChipSelect
            name="styles"
            legend="Tus estilos"
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
