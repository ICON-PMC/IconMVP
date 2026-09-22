import Link from "next/link";

export function SavedTabs({ active }: { active: "guardados" | "siguiendo" }) {
  const tab = (isActive: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium ${
      isActive ? "bg-forest text-white" : "text-ink/60 hover:text-forest"
    }`;
  return (
    <nav
      aria-label="Secciones de lo mío"
      className="glass-input mt-6 mb-6 inline-flex rounded-full p-1"
    >
      <Link
        href="/saved?tab=guardados"
        className={tab(active === "guardados")}
        aria-current={active === "guardados" ? "page" : undefined}
      >
        Guardados
      </Link>
      <Link
        href="/saved?tab=siguiendo"
        className={tab(active === "siguiendo")}
        aria-current={active === "siguiendo" ? "page" : undefined}
      >
        Siguiendo
      </Link>
    </nav>
  );
}
