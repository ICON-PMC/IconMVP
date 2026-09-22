import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Barra de acciones fija abajo (móvil) — respeta el área segura del dispositivo.
 * Pensada para selección múltiple o un "Guardar" siempre visible. Usa `PageShell`,
 * que ya deja `pb-safe-bar` para que no tape el último elemento.
 */
export function StickyActionBar({
  children,
  label,
  className,
}: {
  children: ReactNode;
  /** Texto de estado, p. ej. "3 seleccionadas". Se anuncia a lectores de pantalla. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass fixed inset-x-0 bg-cream/95 bottom-0 z-40 rounded-t-3xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:rounded-full sm:px-5 sm:py-2.5",
        className,
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 sm:flex-nowrap sm:gap-4">
        {label && (
          <p role="status" aria-live="polite" className="text-sm font-medium text-forest">
            {label}
          </p>
        )}
        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">{children}</div>
      </div>
    </div>
  );
}
