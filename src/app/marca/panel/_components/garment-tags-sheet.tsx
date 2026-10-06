"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { GarmentTagFields } from "@/components/garment-tag-fields";
import { NativeSelect } from "@/components/native-select";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Button } from "@/components/ui/button";
import type { TagOptions } from "@/lib/tags";
import { updateGarmentTags } from "../actions";

/** Hoja para cambiar la categoría y el estilo/ocasión/clima de una prenda ya creada. */
export function GarmentTagsSheet({
  garment,
  tagOptions,
  onOpenChange,
}: {
  garment: { id: string; title: string; tagIds: string[] } | null;
  tagOptions: TagOptions;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const categoryIds = new Set(tagOptions.category.map((c) => c.id));
  const currentCategory = garment?.tagIds.find((id) => categoryIds.has(id)) ?? "";

  function submit(formData: FormData) {
    if (!garment) return;
    start(async () => {
      const r = await updateGarmentTags(garment.id, formData);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Etiquetas guardadas.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <ResponsiveSheet
      open={!!garment}
      onOpenChange={onOpenChange}
      title="Etiquetas"
      description={garment?.title}
    >
      {garment && (
        <form key={garment.id} action={submit} className="flex flex-col gap-4 pb-2">
          <FormField label="Categoría" htmlFor="gt-category">
            <NativeSelect id="gt-category" name="category" defaultValue={currentCategory}>
              <option value="">—</option>
              {tagOptions.category.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <GarmentTagFields options={tagOptions} defaultSelected={garment.tagIds} />
          <Button type="submit" size="lg" disabled={pending} className="w-full rounded-full">
            {pending ? "Guardando…" : "Guardar etiquetas"}
          </Button>
        </form>
      )}
    </ResponsiveSheet>
  );
}
