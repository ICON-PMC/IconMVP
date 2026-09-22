import { SectionHeader } from "@/components/page-shell";
import { CatalogGrid, type CatalogGarment } from "./catalog-grid";
import { NewGarmentForm } from "./new-garment-form";
import { NewGarmentSheet } from "./new-garment-sheet";

export type { CatalogGarment };

export function CatalogTab({
  garments,
  categories,
  sizes,
  canPublish,
}: {
  garments: CatalogGarment[];
  categories: { id: string; name: string }[];
  sizes: { id: string; label: string }[];
  canPublish: boolean;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Catálogo (${garments.length})`}
        description="Las prendas que puedes taggear en tus looks."
        action={
          <NewGarmentSheet garmentCount={garments.length}>
            <NewGarmentForm categories={categories} sizes={sizes} />
          </NewGarmentSheet>
        }
      />
      <CatalogGrid garments={garments} canPublish={canPublish} />
    </div>
  );
}
