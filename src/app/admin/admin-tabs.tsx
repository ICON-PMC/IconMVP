import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function AdminTabs({ active, pendingCount }: { active: "panel" | "marcas"; pendingCount: number }) {
  const tab = (isActive: boolean) =>
    `flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
      isActive ? "bg-forest text-white" : "text-ink/60 hover:text-forest"
    }`;
  return (
    <nav aria-label="Secciones del panel" className="glass-input mt-6 inline-flex rounded-full p-1">
      <Link href="/admin" className={tab(active === "panel")} aria-current={active === "panel" ? "page" : undefined}>
        Carga y métricas
      </Link>
      <Link
        href="/admin?tab=marcas"
        className={tab(active === "marcas")}
        aria-current={active === "marcas" ? "page" : undefined}
      >
        Marcas pendientes
        <Badge className="rounded-full bg-coral px-2 text-white">{pendingCount}</Badge>
      </Link>
    </nav>
  );
}
