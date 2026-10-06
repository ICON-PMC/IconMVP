import { SectionHeader } from "@/components/page-shell";
import type { TagOptions } from "@/lib/tags";
import { CatalogGrid, type CatalogGarment } from "./catalog-grid";
import { NewGarmentForm } from "./new-garment-form";
import { NewGarmentSheet } from "./new-garment-sheet";

export type { CatalogGarment };

export function CatalogTab({
  garments,
  tagOptions,
  sizes,
  canPublish,
}: {
  garments: CatalogGarment[];
  tagOptions: TagOptions;
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
            <NewGarmentForm tagOptions={tagOptions} sizes={sizes} />
          </NewGarmentSheet>
        }
      />
      <CatalogGrid garments={garments} tagOptions={tagOptions} canPublish={canPublish} />
    </div>
  );
}
