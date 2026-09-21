import { LinkTabs } from "@/components/link-tabs";

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
    <LinkTabs
      label="Secciones del panel"
      active={active}
      className="mt-5"
      tabs={PANEL_TABS.map((t) => ({
        id: t.id,
        label: t.label,
        href: t.id === "resumen" ? "/marca/panel" : `/marca/panel?tab=${t.id}`,
        badge: counts[t.id],
      }))}
    />
  );
}
