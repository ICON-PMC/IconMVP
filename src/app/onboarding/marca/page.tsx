import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyBrand } from "@/lib/auth";
import { imageUrl } from "@/lib/images";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { ProfileForm } from "./profile-form";
import { CoverForm } from "./cover-form";
import { GarmentForm } from "./garment-form";
import { removeOnboardingGarment, submitBrandForReview } from "./actions";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STEPS = ["Perfil", "Portada", "Prenda"];

export default async function BrandOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ paso?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/onboarding/marca");

  const brand = await getMyBrand();
  const supabase = await createClient();

  // Aprobada → panel. Rechazada → puede editar y reenviar. Pendiente ya enviada → confirmación.
  if (brand?.status === "active") redirect("/marca/panel");
  const resubmitting = brand?.status === "rejected";
  if (brand?.status === "pending" && brand.submitted_at) {
    return (
      <>
        <Aurora />
        <main className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
          <GlassCard className="w-full max-w-md p-6 text-center sm:p-8">
            <h1 className="text-2xl font-medium tracking-tight text-forest">
              Tu perfil está en revisión
            </h1>
            <p className="mt-2 mb-6 text-sm text-ink/70">
              Te avisaremos por correo cuando sea aprobado.
            </p>
            <Button
              nativeButton={false}
              render={<Link href="/marca/panel" />}
              className="h-10 rounded-xl bg-forest px-6 text-sm text-white hover:bg-forest-deep"
            >
              Ir a mi panel
            </Button>
          </GlassCard>
        </main>
      </>
    );
  }

  // Sin marca solo existe el paso 1; con marca, ?paso permite volver a editar. Por defecto
  // se continúa donde se quedó: sin portada → 2, con portada → 3.
  const { paso } = await searchParams;
  const step = !brand
    ? 1
    : paso === "1" || (resubmitting && !paso)
      ? 1
      : paso === "2" || !brand.logo_url
        ? 2
        : paso === "3" || !resubmitting
          ? 3
          : 1;

  const [{ data: cities }, { data: categories }] = await Promise.all([
    supabase.from("cities").select("id, name").order("name"),
    supabase.from("tags").select("id, name").eq("type", "category").order("name"),
  ]);

  const saved: { id: string; title: string; price: number | null; image: string | null }[] = [];
  if (brand && step === 3) {
    const { data: garments } = await supabase
      .from("garments")
      .select("id, title, price_cop")
      .eq("brand_id", brand.id)
      .order("created_at");
    const ids = (garments ?? []).map((g) => g.id);
    const { data: imgs } = ids.length
      ? await supabase
          .from("garment_images")
          .select("garment_id, cf_image_id")
          .in("garment_id", ids)
          .eq("position", 0)
      : { data: [] };
    const byGarment = new Map((imgs ?? []).map((i) => [i.garment_id, i.cf_image_id]));
    for (const g of garments ?? [])
      saved.push({ id: g.id, title: g.title, price: g.price_cop, image: imageUrl(byGarment.get(g.id)) });
  }

  return (
    <>
      <Aurora />
      <main className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
        <GlassCard className="w-full max-w-md p-6 sm:p-8">
          {resubmitting && (
            <div role="status" className="mb-5 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
              <p className="font-medium">Ajusta tu perfil y vuelve a enviarlo.</p>
              {brand?.rejection_note && <p className="mt-1">{brand.rejection_note}</p>}
            </div>
          )}
          <ol className="mb-6 flex items-center gap-2 text-xs">
            {STEPS.map((label, i) => (
              <li
                key={label}
                aria-current={i + 1 === step ? "step" : undefined}
                className={`flex items-center gap-1.5 ${i + 1 <= step ? "font-medium text-forest" : "text-ink/40"}`}
              >
                <span
                  className={`grid size-5 place-items-center rounded-full text-[11px] ${i + 1 <= step ? "bg-forest text-white" : "bg-ink/10"}`}
                >
                  {i + 1}
                </span>
                {label}
                {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-ink/15" />}
              </li>
            ))}
          </ol>

          {step === 1 ? (
            <>
              <h1 className="text-2xl font-medium tracking-tight text-forest">
                Cuéntanos de tu marca
              </h1>
              <p className="mt-1 mb-6 text-sm text-ink/70">
                Icon es para marcas colombianas independientes. Revisamos cada perfil antes de publicarlo.
              </p>
              <ProfileForm
                cities={cities ?? []}
                defaults={{
                  name: brand?.name ?? "",
                  bio: brand?.bio ?? "",
                  city: brand?.city_id ?? "",
                  link: brand?.store_url ?? "",
                }}
              />
            </>
          ) : step === 3 ? (
            <>
              <h1 className="text-2xl font-medium tracking-tight text-forest">Tu primera prenda</h1>
              <p className="mt-1 mb-6 text-sm text-ink/70">
                Agrega al menos una prenda de tu catálogo para poder enviar tu perfil a revisión.
              </p>

              {saved.length > 0 && (
                <ul className="mb-6 flex flex-col gap-2">
                  {saved.map((g) => (
                    <li key={g.id} className="glass-input flex items-center gap-3 rounded-xl p-2">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-ink/10">
                        {g.image && <Image src={g.image} alt="" fill unoptimized className="object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{g.title}</p>
                        {g.price != null && (
                          <p className="text-xs text-ink/60">${g.price.toLocaleString("es-CO")}</p>
                        )}
                      </div>
                      <form action={removeOnboardingGarment}>
                        <input type="hidden" name="id" value={g.id} />
                        <button className="px-2 text-xs text-ink/50 hover:text-coral hover:underline">
                          Quitar
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <h2 className="mb-3 text-sm font-medium text-forest">
                {saved.length ? "Agregar otra prenda" : "Datos de la prenda"}
              </h2>
              <GarmentForm key={saved.length} categories={categories ?? []} />

              <form action={submitBrandForReview} className="mt-6 border-t border-ink/10 pt-6">
                <Button
                  type="submit"
                  disabled={saved.length === 0}
                  className="h-10 w-full rounded-xl bg-coral text-sm text-white hover:bg-coral/90"
                >
                  {resubmitting ? "Reenviar para aprobación" : "Enviar para aprobación"}
                </Button>
                {saved.length === 0 && (
                  <p className="mt-2 text-center text-xs text-ink/50">
                    Guarda al menos una prenda para poder enviar.
                  </p>
                )}
                <p className="mt-3 text-center">
                  <Link href="/onboarding/marca?paso=2" className="text-xs text-ink/50 hover:underline">
                    Atrás
                  </Link>
                </p>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-medium tracking-tight text-forest">Foto de portada</h1>
              <p className="mt-1 mb-6 text-sm text-ink/70">
                La primera imagen que verá quien llegue a tu perfil.
              </p>
              <CoverForm currentUrl={imageUrl(brand?.logo_url)} />
            </>
          )}
        </GlassCard>
      </main>
    </>
  );
}
