import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Estado vacío del sistema (spec 007): bloque de color suave, ícono, título, texto y una acción.
 * `action` acepta un enlace ({ label, href }) o un nodo propio (compatibilidad con usos anteriores).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string } | ReactNode;
}) {
  const isLink = action && typeof action === "object" && "href" in (action as object) && "label" in (action as object);
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] bg-surface-sunken px-6 py-12 text-center">
      {Icon && (
        <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-surface-raised text-text">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className="text-h3 text-text">{title}</p>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {action != null && (
        <div className="mt-3">
          {isLink ? (
            <Button
              variant="secondary"
              render={<Link href={(action as { href: string }).href} />}
              nativeButton={false}
            >
              {(action as { label: string }).label}
            </Button>
          ) : (
            (action as ReactNode)
          )}
        </div>
      )}
    </div>
  );
}
