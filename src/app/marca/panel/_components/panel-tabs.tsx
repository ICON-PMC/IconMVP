import Link from "next/link";
import { cn } from "@/lib/utils";

export const PANEL_TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "catalogo", label: "Catálogo" },
  { id: "looks", label: "Looks" },
  { id: "perfil", label: "Perfil" },
] as const;

export type PanelTab = (typeof PANEL_TABS)[number]["id"];

export function parseTab(v: string | undefined): PanelTab {
  return PANEL_TABS.some((t) => t.id === v) ? (v as PanelTab) : "resumen";
}

/** Navegación por URL (`?tab=`): enlazable y sobrevive a los redirects de las server actions. */
export function PanelTabs({
  active,
  counts,
}: {
  active: PanelTab;
  counts: Partial<Record<PanelTab, number>>;
}) {
  return (
    <nav
      aria-label="Secciones del panel"
      className="glass-input -mx-4 mt-5 overflow-x-auto rounded-none px-4 py-1 sm:mx-0 sm:rounded-full sm:px-1"
    >
      <ul className="flex min-w-max gap-1">
        {PANEL_TABS.map((t) => {
          const isActive = t.id === active;
          const n = counts[t.id];
          return (
            <li key={t.id}>
              <Link
                href={t.id === "resumen" ? "/marca/panel" : `/marca/panel?tab=${t.id}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors md:min-h-9",
                  isActive ? "bg-forest text-white" : "text-ink/70 hover:text-forest",
                )}
              >
                {t.label}
                {n != null && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px]",
                      isActive ? "bg-white/25" : "bg-ink/10",
                    )}
                  >
                    {n}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
