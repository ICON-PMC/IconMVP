"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { TypeToConfirmDialog } from "@/components/type-to-confirm-dialog";
import { Button } from "@/components/ui/button";
import { closeBrandAccount } from "../actions";

/** Zona de peligro de Panel → Perfil: cerrar la cuenta de la marca (irreversible). */
export function CloseBrandSection({ brandName }: { brandName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-2xl border border-coral/30 p-5">
      <h2 className="text-base font-medium text-coral">Cerrar la cuenta de la marca</h2>
      <p className="mt-1 text-sm text-ink/70">
        Borra la marca con todo su catálogo, sus looks y sus fotos. Tu cuenta de usuario sigue
        activa. No se puede deshacer.
      </p>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full"
      >
        Cerrar cuenta de marca
      </Button>
      <TypeToConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`¿Cerrar ${brandName}?`}
        description={
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-left">
            <li>Se borran todas las prendas, los looks y sus fotos.</li>
            <li>Quienes la siguen o guardaron sus prendas dejan de verlas.</li>
            <li>Las métricas de clics quedan, sin el nombre de la marca.</li>
          </ul>
        }
        phrase={brandName}
        confirmLabel="Cerrar marca"
        pending={pending}
        onConfirm={(typed) =>
          start(async () => {
            const r = await closeBrandAccount(typed);
            // Si sale bien, la acción redirige; aquí solo llegan los errores.
            if (r && !r.ok) toast.error(r.error);
          })
        }
      />
    </section>
  );
}
