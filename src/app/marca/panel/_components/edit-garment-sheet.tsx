"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Button } from "@/components/ui/button";
import type { TagOptions } from "@/lib/tags";
import { updateBrandGarment } from "../actions";
import type { CatalogGarment } from "./catalog-grid";
import { GarmentFields } from "./garment-fields";

/** Hoja para editar una prenda ya creada: todos sus campos y, si se quiere, la foto. */
export function EditGarmentSheet({
  garment,
  tagOptions,
  sizes,
  onOpenChange,
}: {
  garment: CatalogGarment | null;
  tagOptions: TagOptions;
  sizes: { id: string; label: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const categoryIds = new Set(tagOptions.category.map((c) => c.id));

  function submit(formData: FormData) {
    if (!garment) return;
    start(async () => {
      const r = await updateBrandGarment(garment.id, formData);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Prenda guardada.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <ResponsiveSheet open={!!garment} onOpenChange={onOpenChange} title="Editar prenda" description={garment?.title}>
      {garment && (
        <form key={garment.id} action={submit} className="flex flex-col gap-4 pb-2">
          {garment.source === "user_proposed" && (
            <p role="note" className="rounded-[var(--radius-field)] bg-surface-sunken px-3.5 py-2.5 text-sm text-text">
              Creada a partir de una prenda propuesta por un usuario. Completa precio, enlace y foto, y publícala: los looks
              que la usan pasan a mostrar tu prenda con el botón a tu tienda.
            </p>
          )}
          <GarmentFields
            idPrefix="eg"
            tagOptions={tagOptions}
            sizes={sizes}
            defaults={{
              title: garment.title,
              price_cop: garment.price_cop,
              product_url: garment.product_url,
              color: garment.color,
              fabric: garment.fabric,
              description: garment.description,
              categoryId: garment.tagIds.find((id) => categoryIds.has(id)) ?? "",
              sizeIds: garment.sizeIds,
              tagIds: garment.tagIds,
            }}
          />
          <Button type="submit" size="lg" disabled={pending} className="w-full rounded-full">
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      )}
    </ResponsiveSheet>
  );
}
