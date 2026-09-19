import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/glass-card";
import { imageUrl } from "@/lib/images";
import { ReviewActions } from "./review-actions";

// Marcas que ya se enviaron a revisión (los registros a medias no tienen `submitted_at`).
export async function pendingBrandsCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("brands")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .not("submitted_at", "is", null);
  return count ?? 0;
}

export async function PendingBrands() {
  const supabase = await createClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, bio, logo_url, store_url, city_id, submitted_at")
    .eq("status", "pending")
    .not("submitted_at", "is", null)
    .order("submitted_at");

  if (!brands?.length) {
    return (
      <GlassCard className="mt-6 p-8 text-center text-sm text-ink/60">
        No hay marcas pendientes de revisión.
      </GlassCard>
    );
  }

  const brandIds = brands.map((b) => b.id);
  const cityIds = [...new Set(brands.map((b) => b.city_id).filter((c): c is string => !!c))];
  const [{ data: cities }, { data: garments }] = await Promise.all([
    cityIds.length
      ? supabase.from("cities").select("id, name").in("id", cityIds)
      : Promise.resolve({ data: [] }),
    supabase.from("garments").select("id, brand_id, title").in("brand_id", brandIds).order("created_at"),
  ]);
  const gIds = (garments ?? []).map((g) => g.id);
  const { data: images } = gIds.length
    ? await supabase
        .from("garment_images")
        .select("garment_id, cf_image_id")
        .in("garment_id", gIds)
        .eq("position", 0)
    : { data: [] };

  const cityName = new Map((cities ?? []).map((c) => [c.id, c.name]));
  const imageOf = new Map((images ?? []).map((i) => [i.garment_id, i.cf_image_id]));

  return (
    <ul className="mt-6 flex flex-col gap-4">
      {brands.map((b) => {
        const mine = (garments ?? []).filter((g) => g.brand_id === b.id);
        const cover = imageUrl(b.logo_url);
        return (
          <li key={b.id}>
            <GlassCard className="p-5">
              <div className="flex gap-4">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-ink/10">
                  {cover && <Image src={cover} alt={`Portada de ${b.name}`} fill unoptimized className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-medium text-forest">{b.name}</h3>
                  <p className="text-xs text-ink/50">
                    {b.city_id ? cityName.get(b.city_id) : "Sin ciudad"} · enviada el{" "}
                    {new Date(b.submitted_at!).toLocaleDateString("es-CO")}
                  </p>
                  <p className="mt-2 text-sm text-ink/80">{b.bio}</p>
                  {b.store_url && (
                    <a
                      href={b.store_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block truncate text-xs text-coral hover:underline"
                    >
                      {b.store_url}
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/50">
                  Prendas enviadas ({mine.length})
                </p>
                <ul className="flex flex-wrap gap-2">
                  {mine.map((g) => {
                    const src = imageUrl(imageOf.get(g.id));
                    return (
                      <li key={g.id} className="w-20">
                        <div className="relative aspect-square overflow-hidden rounded-xl bg-ink/10">
                          {src && <Image src={src} alt={g.title} fill unoptimized className="object-cover" />}
                        </div>
                        <p className="mt-1 truncate text-xs text-ink/70">{g.title}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-4 flex justify-end border-t border-ink/10 pt-4">
                <ReviewActions brandId={b.id} brandName={b.name} />
              </div>
            </GlassCard>
          </li>
        );
      })}
    </ul>
  );
}
