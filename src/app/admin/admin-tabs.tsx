import { LinkTabs } from "@/components/link-tabs";

const TABS = ["metricas", "cargar", "pendientes", "marcas", "usuarios", "etiquetas"] as const;
export type AdminTab = (typeof TABS)[number];

export function parseAdminTab(v: string | undefined): AdminTab {
  return TABS.includes(v as AdminTab) ? (v as AdminTab) : "metricas";
}

export function AdminTabs({ active, pendingCount }: { active: AdminTab; pendingCount: number }) {
  return (
    <LinkTabs
      label="Secciones del panel"
      active={active}
      className="mt-6"
      tabs={[
        { id: "metricas", label: "Métricas", href: "/admin" },
        { id: "cargar", label: "Cargar contenido", href: "/admin?tab=cargar" },
        { id: "pendientes", label: "Pendientes", href: "/admin?tab=pendientes", badge: pendingCount },
        { id: "marcas", label: "Marcas", href: "/admin?tab=marcas" },
        { id: "usuarios", label: "Usuarios", href: "/admin?tab=usuarios" },
        { id: "etiquetas", label: "Etiquetas", href: "/admin?tab=etiquetas" },
      ]}
    />
  );
}
