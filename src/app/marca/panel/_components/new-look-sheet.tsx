"use client";

import { useEffect, useState } from "react";
import { PlusIcon } from "lucide-react";
import { FormField } from "@/components/form-field";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createBrandPost } from "../actions";

/**
 * Look subido a mano (no hace falta Instagram): foto + caption. La acción lo crea en borrador y
 * redirige al editor del look, donde se etiquetan las prendas y se publica.
 */
export function NewLookSheet() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  // URL de blob solo para la vista previa local; a R2 se sube el archivo.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="rounded-full sm:px-5">
        <PlusIcon data-icon="inline-start" /> Nuevo look
      </Button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Nuevo look"
        description="Queda como borrador; después etiquetas las prendas y lo publicas."
      >
        <form action={createBrandPost} className="flex flex-col gap-4 pb-2">
          <FormField label="Foto" htmlFor="nl-image">
            <Input
              id="nl-image"
              name="image"
              type="file"
              accept="image/*"
              required
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
            />
          </FormField>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Vista previa" className="max-h-64 w-full rounded-xl object-cover" />
          )}
          <FormField label="Texto (opcional)" htmlFor="nl-caption">
            <Textarea id="nl-caption" name="caption" rows={3} maxLength={2200} />
          </FormField>
          <SubmitButton size="lg" pendingText="Subiendo…" className="w-full rounded-full">
            Crear look
          </SubmitButton>
        </form>
      </ResponsiveSheet>
    </>
  );
}
