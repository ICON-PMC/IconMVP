import { SubmitButton } from "@/components/submit-button";
import type { TagOptions } from "@/lib/tags";
import { createBrandGarment } from "../actions";
import { GarmentFields } from "./garment-fields";

export function NewGarmentForm({
  tagOptions,
  sizes,
}: {
  tagOptions: TagOptions;
  sizes: { id: string; label: string }[];
}) {
  return (
    <form action={createBrandGarment} className="flex flex-col gap-4 pb-2">
      <GarmentFields tagOptions={tagOptions} sizes={sizes} />
      <SubmitButton size="lg" pendingText="Agregando…" className="w-full rounded-full">
        Agregar prenda
      </SubmitButton>
    </form>
  );
}
