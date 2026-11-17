"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Button } from "@/components/ui/button";
import { markProfileNoticeSeen } from "@/app/(app)/u/[handle]/actions";

/**
 * Aviso único a cuentas que existían antes del perfil público (spec 009, FR-016). Aparece una vez;
 * "Entendido" o "Ir a privacidad" lo marcan visto.
 */
export function ProfileNotice({ handle, showLikes }: { handle: string; showLikes: boolean }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  function close(goTo?: string) {
    setOpen(false);
    void markProfileNoticeSeen();
    if (goTo) router.push(goTo);
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Tu perfil ahora es público"
      description={`Tienes una página en iconcolombia.com/u/${handle}.`}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => close("/settings#privacidad")}>
            Ir a privacidad
          </Button>
          <Button onClick={() => close()}>Entendido</Button>
        </div>
      }
    >
      <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-6 text-text">
        <li>Se ven tu foto, tu nombre, tu bio y los looks que publiques.</li>
        <li>
          {showLikes
            ? "También se ven las prendas y los looks que te gustan. Puedes ocultarlos."
            : "Lo que te gusta está oculto. Puedes mostrarlo si quieres."}
        </li>
        <li>Lo que guardas nunca se muestra.</li>
        <li>Si prefieres que nadie vea tu perfil, puedes hacerlo privado.</li>
      </ul>
    </ResponsiveSheet>
  );
}
