import Link from "next/link";
import { cn } from "@/lib/utils";

export type LinkTab = { id: string; label: string; href: string; badge?: number };

/**
 * Pestañas basadas en URL (enlazables, sobreviven a los redirects de server actions). Spec 007:
 * - `pill` (por defecto): para cambiar de vista; la activa en tinta con texto crema.
 * - `underline`: para perfiles y páginas de marca; la activa subrayada.
 * En móvil hacen scroll horizontal; cada pestaña mide al menos 44 px de alto.
 */
export function LinkTabs({
  tabs,
  active,
  label,
  size = "md",
  variant = "pill",
  className,
}: {
  tabs: LinkTab[];
  active: string;
  label: string;
  size?: "sm" | "md";
  variant?: "pill" | "underline";
  className?: string;
}) {
  const underline = variant === "underline";
  return (
    <nav
      aria-label={label}
      className={cn(
        "max-w-full overflow-x-auto",
        underline
          ? "border-b border-line"
          : size === "md"
            ? "-mx-4 px-4 sm:mx-0 sm:w-fit sm:px-0"
            : "w-fit",
        className,
      )}
    >
      <ul className={cn("flex min-w-max", underline ? "gap-5" : "gap-2")}>
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <li key={t.id}>
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-line-strong",
                  underline
                    ? cn(
                        "-mb-px border-b-2 px-0.5",
                        isActive ? "border-text text-text" : "border-transparent text-text-muted hover:text-text",
                      )
                    : cn(
                        "rounded-full px-4",
                        isActive
                          ? "bg-surface-inverse text-text-inverse"
                          : "border-[1.5px] border-line-strong text-text hover:bg-surface-sunken",
                      ),
                )}
              >
                {t.label}
                {t.badge != null && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] tabular-nums",
                      isActive && !underline ? "bg-white/20" : "bg-surface-sunken",
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
