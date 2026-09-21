import { GlassCard } from "@/components/glass-card";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { imageUrl } from "@/lib/images";
import { formatCop } from "@/lib/taxonomy";
import { NewGarmentForm } from "./new-garment-form";

export type CatalogGarment = {
  id: string;
  title: string;
  price_cop: number | null;
  status: string;
  cf_image_id: string | null;
};

export function CatalogTab({
  garments,
  categories,
  sizes,
}: {
  garments: CatalogGarment[];
  categories: { id: string; name: string }[];
  sizes: { id: string; label: string }[];
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Catálogo (${garments.length})`}
        description="Las prendas que puedes taggear en tus looks."
      />

      {garments.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {garments.map((g) => {
            const img = imageUrl(g.cf_image_id);
            return (
              <li key={g.id} className="glass-input overflow-hidden rounded-2xl p-2">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt={g.title}
                    className="mb-2 aspect-square w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="mb-2 aspect-square w-full rounded-xl bg-ink/5" aria-hidden />
                )}
                <p className="truncate text-sm font-medium text-ink">{g.title}</p>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="text-xs text-ink/60">
                    {g.price_cop != null ? formatCop(g.price_cop) : "Sin precio"}
                  </span>
                  <StatusBadge status={g.status} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="Tu catálogo está vacío"
          description="Agrega tu primera prenda para poder taggearla en un look."
        />
      )}

      <GlassCard className="p-5">
        <NewGarmentForm categories={categories} sizes={sizes} />
      </GlassCard>
    </div>
  );
}
