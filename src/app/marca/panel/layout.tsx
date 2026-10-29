import type { ReactNode } from "react";
import { requireBrandOwner } from "@/lib/auth";
import { stopManagingBrand } from "@/app/admin/actions";

/**
 * Aviso fijo cuando el staff está gestionando una marca desde /admin ("Gestionar"): todo lo que
 * haga en el panel queda a nombre de esa marca. "Salir" borra la cookie y vuelve a /admin.
 */
export default async function BrandPanelLayout({ children }: { children: ReactNode }) {
  const { brand, actingAsStaff } = await requireBrandOwner();
  return (
    <>
      {actingAsStaff && brand && (
        <div
          role="status"
          className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-ink px-4 py-2 text-sm text-white"
        >
          <span className="min-w-0 truncate">
            Estás gestionando <strong className="font-medium">{brand.name}</strong>
          </span>
          <form action={stopManagingBrand}>
            <button
              type="submit"
              className="min-h-9 shrink-0 rounded-full bg-white/15 px-3 text-sm font-medium hover:bg-white/25"
            >
              Salir
            </button>
          </form>
        </div>
      )}
      {children}
    </>
  );
}
