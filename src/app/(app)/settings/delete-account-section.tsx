"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { TypeToConfirmDialog } from "@/components/type-to-confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteMyAccount } from "./actions";

/** Zona de peligro de /settings: borrar la cuenta (y la marca, si tiene una). Irreversible. */
export function DeleteAccountSection({ brandName }: { brandName: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <section className="mt-6 rounded-[var(--radius-card)] border-[1.5px] border-danger/40 p-5">
      <h2 className="text-h3 text-danger">Eliminar mi cuenta</h2>
      <p className="mt-1 text-sm text-text">
        Borra tu cuenta y no podrás volver a entrar con ella.
        {brandName && ` También se borra ${brandName} con todo su contenido.`} No se puede deshacer.
      </p>
      <Button
        type="button"
        variant="danger"
        onClick={() => setOpen(true)}
        className="mt-4"
      >
        Eliminar mi cuenta
      </Button>
      <TypeToConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Eliminar tu cuenta?"
        description={
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-left">
            <li>Se borran tus guardados, likes, marcas que sigues y preferencias.</li>
            {brandName && <li>Se borra {brandName} con su catálogo, sus looks y sus fotos.</li>}
            <li>Tu correo queda libre para crear una cuenta nueva.</li>
          </ul>
        }
        phrase="ELIMINAR"
        confirmLabel="Eliminar cuenta"
        pending={pending}
        onConfirm={(typed) =>
          start(async () => {
            const r = await deleteMyAccount(typed);
            // Si sale bien, la acción redirige; aquí solo llegan los errores.
            if (r && !r.ok) toast.error(r.error);
          })
        }
      />
    </section>
  );
}
