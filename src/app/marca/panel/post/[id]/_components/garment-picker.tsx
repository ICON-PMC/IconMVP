"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { SearchableChecklist, type ChecklistOption } from "@/components/searchable-checklist";
import { tagGarmentsOnPost } from "../../../actions";

/** Botón + hoja para taggear varias prendas del catálogo a la vez. */
export function GarmentPicker({
  postId,
  options,
}: {
  postId: string;
  options: ChecklistOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const r = await tagGarmentsOnPost(postId, selected);
      if (!r.ok) return void toast.error(r.error);
      toast.success(selected.length === 1 ? "Prenda taggeada." : `${selected.length} prendas taggeadas.`);
      setSelected([]);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={!options.length}
        onClick={() => setOpen(true)}
        className="w-full rounded-full sm:w-auto"
      >
        <PlusIcon data-icon="inline-start" /> Agregar prendas
      </Button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Agregar prendas"
        description="Elige las prendas de tu catálogo que aparecen en este look."
        footer={
          <Button
            type="button"
            size="lg"
            disabled={!selected.length || pending}
            onClick={submit}
            className="w-full rounded-full"
          >
            {pending
              ? "Agregando…"
              : selected.length
                ? `Agregar ${selected.length} ${selected.length === 1 ? "prenda" : "prendas"}`
                : "Elige al menos una"}
          </Button>
        }
      >
        <SearchableChecklist
          options={options}
          selected={selected}
          onChange={setSelected}
          searchLabel="Buscar prenda"
          emptyText="Ninguna prenda coincide."
        />
      </ResponsiveSheet>
    </>
  );
}
