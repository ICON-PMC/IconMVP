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
  stackAboveNav = false,
}: {
  children: ReactNode;
  /** Texto de estado, p. ej. "3 seleccionadas". Se anuncia a lectores de pantalla. */
  label?: string;
  className?: string;
  /** true en rutas del grupo (app), donde hay barra inferior en móvil. */
  stackAboveNav?: boolean;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 rounded-t-[var(--radius-sheet)] border-t border-line bg-surface-raised px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-float)]",
        // Dentro de la app con barra inferior (móvil), se apila encima de ella (spec 007).
        stackAboveNav && "max-md:bottom-[calc(var(--bottom-nav-h)+8px+env(safe-area-inset-bottom))] max-md:rounded-[var(--radius-card)] max-md:mx-3 max-md:border",
        "sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:rounded-full sm:px-5 sm:py-2.5",
        className,
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 sm:flex-nowrap sm:gap-4">
        {label && (
          <p role="status" aria-live="polite" className="text-sm font-semibold text-text">
            {label}
          </p>
        )}
        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">{children}</div>
      </div>
    </div>
  );
}
