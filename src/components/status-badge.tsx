import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "Publicado", cls: "bg-leaf-soft text-forest-deep" },
  draft: { label: "Borrador", cls: "bg-ink/10 text-ink/70" },
  pending: { label: "Pendiente", cls: "bg-honey-soft text-ink/80" },
  archived: { label: "Archivado", cls: "bg-blush/50 text-ink/70" },
};

/** Estado de contenido. Siempre lleva texto: el color solo refuerza. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-ink/10 text-ink/70" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        s.cls,
        className,
      )}
    >
      {s.label}
    </span>
  );
}
