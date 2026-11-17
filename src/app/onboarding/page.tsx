import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { ChipSelect } from "@/components/chip-select";
import { CityCombobox } from "@/components/city-combobox";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { getCityOptions } from "@/lib/cities";
import { completeOnboarding, saveOnboardingProfile } from "./actions";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { HandleField } from "@/components/profile/handle-field";
import Link from "next/link";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ paso?: string; error?: string }> }) {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/onboarding");
  const { paso, error } = await searchParams;
  const me = session.profile;

  // Paso final opcional (spec 009): nombre de usuario y foto.
  if (paso === "perfil" && me.role !== "brand") {
    return (
      <AuthShell title="Tu perfil" subtitle="Elige cómo te encuentran en Icon. Puedes cambiarlo después.">
        <div className="flex flex-col gap-6">
          <AvatarUploader avatar={me.avatar_key} name={me.display_name?.trim() || me.handle} seed={me.id} />
          <form action={saveOnboardingProfile} className="flex flex-col gap-6">
            <HandleField defaultValue={me.handle} error={error} />
            <div className="flex flex-col gap-2">
              <Button type="submit" size="lg" className="w-full">
                Listo
              </Button>
              <Button variant="ghost" className="w-full" render={<Link href="/feed" />} nativeButton={false}>
                Omitir
              </Button>
            </div>
          </form>
        </div>
      </AuthShell>
    );
  }
  if (me.onboarded) redirect("/feed");

  const supabase = await createClient();
  const [{ data: styles }, cities] = await Promise.all([
    supabase.from("tags").select("id, name").eq("type", "style").eq("is_hidden", false).order("name"),
    getCityOptions(supabase),
  ]);

  // Primer paso tras el registro (spec 007, US5): estilos como chips con contador y ciudad.
  return (
    <AuthShell title="Te damos la bienvenida a Icon" subtitle="Cuéntanos tu estilo para personalizar tu feed.">
      <form action={completeOnboarding} className="flex flex-col gap-6">
        <ChipSelect name="styles" legend="Tus estilos" options={styles ?? []} />
        <FormField label="Tu ciudad" htmlFor="city">
          <CityCombobox id="city" name="city" options={cities} />
        </FormField>
        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" className="w-full">
            Continuar
          </Button>
          <Button type="submit" name="skip" value="1" variant="ghost" className="w-full">
            Saltar por ahora
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
