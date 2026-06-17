import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { completeOnboarding } from "./actions";

export default async function OnboardingPage() {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/onboarding");
  if (session.profile.onboarded) redirect("/feed");

  const supabase = await createClient();
  const [{ data: styles }, { data: cities }] = await Promise.all([
    supabase.from("tags").select("id, name").eq("type", "style").order("name"),
    supabase.from("cities").select("id, name").order("name"),
  ]);

  return (
    <>
      <Aurora />
      <main className="flex min-h-dvh items-center justify-center p-6">
        <GlassCard className="w-full max-w-lg p-8">
          <h1 className="text-2xl font-medium tracking-tight text-forest">
            Bienvenida a Icon
          </h1>
          <p className="mt-1 mb-6 text-sm text-ink/70">
            Cuéntanos tu estilo para personalizar tu feed.
          </p>

          <form action={completeOnboarding} className="flex flex-col gap-6">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/50">
                Tus estilos
              </p>
              <div className="flex flex-wrap gap-2">
                {(styles ?? []).map((s) => (
                  <label key={s.id} className="cursor-pointer">
                    <input
                      type="checkbox"
                      name="styles"
                      value={s.id}
                      className="peer sr-only"
                    />
                    <span className="glass-input inline-block rounded-full px-3 py-1 text-sm text-ink/80 peer-checked:bg-forest peer-checked:text-white">
                      {s.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/50">
                Tu ciudad
              </p>
              <div className="flex flex-wrap gap-2">
                {(cities ?? []).map((c) => (
                  <label key={c.id} className="cursor-pointer">
                    <input
                      type="radio"
                      name="city"
                      value={c.id}
                      className="peer sr-only"
                    />
                    <span className="glass-input inline-block rounded-full px-3 py-1 text-sm text-ink/80 peer-checked:bg-forest peer-checked:text-white">
                      {c.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="rounded-full bg-forest px-6 py-2.5 text-sm font-medium text-white hover:bg-forest-deep"
              >
                Continuar
              </button>
              <button
                type="submit"
                name="skip"
                value="1"
                className="text-sm text-ink/50 hover:underline"
              >
                Saltar
              </button>
            </div>
          </form>
        </GlassCard>
      </main>
    </>
  );
}
