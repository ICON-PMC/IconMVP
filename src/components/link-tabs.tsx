import Link from "next/link";
import { cn } from "@/lib/utils";

export type LinkTab = { id: string; label: string; href: string; badge?: number };

/**
 * Pestañas basadas en URL (enlazables, sobreviven a los redirects de server actions).
 * En móvil ocupan todo el ancho y hacen scroll horizontal; desde `sm` son una píldora.
 */
export function LinkTabs({
  tabs,
  active,
  label,
  size = "md",
  className,
}: {
  tabs: LinkTab[];
  active: string;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "glass-input overflow-x-auto",
        size === "md"
          ? "-mx-4 rounded-none px-4 py-1 sm:mx-0 sm:w-fit sm:max-w-full sm:rounded-full sm:px-1"
          : "w-fit max-w-full rounded-full p-1",
        className,
      )}
    >
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <li key={t.id}>
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors md:min-h-9",
                  isActive ? "bg-forest text-white" : "text-ink/70 hover:text-forest",
                )}
              >
                {t.label}
                {t.badge != null && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px]",
                      isActive ? "bg-white/25" : "bg-ink/10",
                    )}
                  >
                    {t.badge}
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
