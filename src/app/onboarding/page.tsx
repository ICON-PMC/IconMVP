import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { ChipSelect } from "@/components/chip-select";
import { CityCombobox } from "@/components/city-combobox";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { getCityOptions } from "@/lib/cities";
import { completeOnboarding } from "./actions";

export default async function OnboardingPage() {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/onboarding");
  if (session.profile.onboarded) redirect("/feed");

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
