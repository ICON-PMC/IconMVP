import { LinkTabs } from "@/components/link-tabs";

const TABS = ["metricas", "cargar", "pendientes", "reportes", "comunidad", "marcas", "usuarios", "etiquetas"] as const;
export type AdminTab = (typeof TABS)[number];

export function parseAdminTab(v: string | undefined): AdminTab {
  return TABS.includes(v as AdminTab) ? (v as AdminTab) : "metricas";
}

export function AdminTabs({ active, pendingCount, reportsCount = 0 }: { active: AdminTab; pendingCount: number; reportsCount?: number }) {
  return (
    <LinkTabs
      label="Secciones del panel"
      active={active}
      className="mt-6"
      tabs={[
        { id: "metricas", label: "Métricas", href: "/admin" },
        { id: "cargar", label: "Cargar contenido", href: "/admin?tab=cargar" },
        { id: "pendientes", label: "Pendientes", href: "/admin?tab=pendientes", badge: pendingCount },
        { id: "reportes", label: "Reportes", href: "/admin?tab=reportes", badge: reportsCount },
        { id: "comunidad", label: "Comunidad", href: "/admin?tab=comunidad" },
        { id: "marcas", label: "Marcas", href: "/admin?tab=marcas" },
        { id: "usuarios", label: "Usuarios", href: "/admin?tab=usuarios" },
        { id: "etiquetas", label: "Etiquetas", href: "/admin?tab=etiquetas" },
        // Página aparte (spec 007): nunca queda activa desde el panel.
        { id: "estilo", label: "Guía de estilo", href: "/admin/estilo" },
      ]}
    />
  );
}
