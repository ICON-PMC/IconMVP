import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { formatCop } from "@/lib/taxonomy";
import { imageUrl } from "@/lib/images";
import { getMySavedIds } from "@/lib/saves";
import { SaveButton } from "@/components/save-button";

export default async function GarmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: g } = await supabase
    .from("garments")
    .select("id, title, description, price_cop, product_url, color, fabric, brand_id")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!g) notFound();

  const { data: images } = await supabase
    .from("garment_images")
    .select("cf_image_id, position")
    .eq("garment_id", id)
    .order("position");

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, slug, city_id, is_verified, is_sustainable")
    .eq("id", g.brand_id)
    .maybeSingle();

  let cityName: string | null = null;
  if (brand?.city_id) {
    cityName =
      (await supabase.from("cities").select("name").eq("id", brand.city_id).maybeSingle())
        .data?.name ?? null;
  }

  const { data: gs } = await supabase
    .from("garment_sizes")
    .select("size_id")
    .eq("garment_id", id);
  const sizeIds = (gs ?? []).map((x) => x.size_id);
  const sizes = sizeIds.length
    ? ((
        await supabase
          .from("sizes")
          .select("label, sort_order")
          .in("id", sizeIds)
          .order("sort_order")
      ).data ?? [])
    : [];

  const { data: gt } = await supabase
    .from("garment_tags")
    .select("tag_id")
    .eq("garment_id", id);
  const tagIds = (gt ?? []).map((x) => x.tag_id);
  const categories = tagIds.length
    ? ((
        await supabase
          .from("tags")
          .select("name")
          .in("id", tagIds)
          .eq("type", "category")
      ).data ?? [])
    : [];

  const gallery = images?.map((i) => i.cf_image_id) ?? [];
  const meta = [g.color, g.fabric].filter(Boolean).join(" · ");
  const saved = await getMySavedIds();

  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <SiteHeader />

        <Link
          href="/feed"
          className="mt-6 inline-block text-sm font-medium text-coral hover:underline"
        >
          ← Volver al feed
        </Link>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {/* Galería */}
          <div className="flex flex-col gap-4">
            {gallery.map((src, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={idx} src={imageUrl(src) ?? ""} alt={g.title} className="w-full rounded-2xl" />
            ))}
          </div>

          {/* Info */}
          <div>
            <GlassCard className="relative p-6">
              <div className="absolute right-4 top-4">
                <SaveButton
                  kind="garment"
                  id={g.id}
                  saved={saved.garments.has(g.id)}
                  path={`/prenda/${g.id}`}
                />
              </div>
              {brand && (
                <Link
                  href={`/marca/${brand.slug}`}
                  className="flex items-center gap-1 text-sm font-medium text-forest hover:underline"
                >
                  {brand.name}
                  {brand.is_verified && (
                    <span aria-label="verificada" title="Verificada por el equipo">
                      ✓
                    </span>
                  )}
                </Link>
              )}
              {cityName && <p className="text-xs text-ink/50">{cityName}</p>}

              <h1 className="mt-3 text-2xl font-medium tracking-tight text-ink">
                {g.title}
              </h1>
              {g.price_cop != null && (
                <p className="mt-1 text-xl text-forest">{formatCop(g.price_cop)}</p>
              )}

              {g.description && (
                <p className="mt-3 text-sm text-ink/70">{g.description}</p>
              )}
              {meta && <p className="mt-3 text-sm text-ink/60">{meta}</p>}

              {categories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <span
                      key={c.name}
                      className="rounded-full bg-white/50 px-2.5 py-0.5 text-xs text-forest-deep"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              )}

              {sizes.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink/50">
                    Tallas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sizes.map((s) => (
                      <span
                        key={s.label}
                        className="glass-input rounded-lg px-2.5 py-1 text-xs text-ink/80"
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <a
                href={`/out/${g.id}?source=garment`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-block rounded-full bg-forest px-6 py-3 text-sm font-medium text-white hover:bg-forest-deep"
              >
                Ver en la tienda ↗
              </a>
            </GlassCard>
          </div>
        </div>
      </div>
    </>
  );
}
