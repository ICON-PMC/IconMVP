"use client";

import { useState, type ReactNode } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/responsive-sheet";

/**
 * Botón + hoja con el formulario de nueva prenda. La server action redirige al terminar, lo que
 * no desmonta este componente: se cierra (y el formulario se reinicia) cuando cambia
 * `garmentCount`, o sea cuando la prenda ya aparece en el catálogo.
 */
export function NewGarmentSheet({
  garmentCount,
  children,
}: {
  garmentCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(garmentCount);
  if (garmentCount !== seen) {
    setSeen(garmentCount);
    setOpen(false);
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="rounded-full sm:px-5">
        <PlusIcon data-icon="inline-start" /> Nueva prenda
      </Button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Nueva prenda"
        description="Se publica en tu catálogo apenas la guardes."
      >
        <div key={garmentCount}>{children}</div>
      </ResponsiveSheet>
    </>
  );
}
