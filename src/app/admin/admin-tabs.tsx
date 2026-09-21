import { LinkTabs } from "@/components/link-tabs";

export type AdminTab = "metricas" | "cargar" | "marcas";

export function parseAdminTab(v: string | undefined): AdminTab {
  return v === "cargar" || v === "marcas" ? v : "metricas";
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
        { id: "marcas", label: "Marcas pendientes", href: "/admin?tab=marcas", badge: pendingCount },
      ]}
    />
  );
}
