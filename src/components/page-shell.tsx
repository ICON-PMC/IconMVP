import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Contenedor de página: ancho máximo, gutters y aire inferior para barras fijas. */
export function PageShell({
  children,
  className,
  width = "3xl",
}: {
  children: ReactNode;
  className?: string;
  width?: "2xl" | "3xl" | "4xl";
}) {
  const max = { "2xl": "max-w-2xl", "3xl": "max-w-3xl", "4xl": "max-w-4xl" }[width];
  return (
    <div className={cn("mx-auto w-full px-4 pt-6 pb-safe-bar", max, className)}>{children}</div>
  );
}

/** Título de sección con descripción y una acción primaria opcional. */
export function SectionHeader({
  title,
  description,
  action,
  as: Tag = "h2",
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <Tag
          className={cn(
            "font-medium tracking-tight text-forest",
            Tag === "h1" ? "text-2xl sm:text-3xl" : "text-lg",
          )}
        >
          {title}
        </Tag>
        {description && <p className="mt-0.5 text-sm text-ink/60">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
