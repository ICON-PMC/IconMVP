import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { SiteHeader } from "@/components/site-header";
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
  const [{ data: styles }, { data: cities }, { data: prefs }] = await Promise.all([
    supabase.from("tags").select("id, name").eq("type", "style").order("name"),
    supabase.from("cities").select("id, name").order("name"),
    supabase.from("user_preferences").select("tag_id").eq("user_id", userId),
  ]);
  const myStyles = new Set((prefs ?? []).map((p) => p.tag_id));
  const myCity = session.profile.home_city_id;

  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <SiteHeader />

        <h1 className="mt-8 text-3xl font-medium tracking-tight text-forest">
          Ajustes
        </h1>
        <p className="mt-1 text-sm text-ink/60">{session.email}</p>

        {ok && (
          <p className="mt-4 rounded-xl bg-leaf-soft px-3 py-2 text-sm text-forest-deep">
            ✓ Cambios guardados.
          </p>
        )}

        <GlassCard className="mt-6 p-6">
          <form action={updateSettings} className="flex flex-col gap-6">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink/50">
                Nombre
              </label>
              <input
                name="display_name"
                defaultValue={session.profile.display_name ?? ""}
                placeholder="Tu nombre"
                className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-ink"
              />
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
                      defaultChecked={c.id === myCity}
                      className="peer sr-only"
                    />
                    <span className="glass-input inline-block rounded-full px-3 py-1 text-sm text-ink/80 peer-checked:bg-forest peer-checked:text-white">
                      {c.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

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
                      defaultChecked={myStyles.has(s.id)}
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
              <button
                type="submit"
                className="rounded-full bg-forest px-6 py-2.5 text-sm font-medium text-white hover:bg-forest-deep"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </>
  );
}
