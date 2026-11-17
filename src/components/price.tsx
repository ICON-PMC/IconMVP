import { formatCop } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

/** Precio en COP (spec 007): único o "desde $X" para rangos. No pinta nada sin precio. */
export function Price({
  min,
  max,
  className,
}: {
  min: number | null | undefined;
  max?: number | null;
  className?: string;
}) {
  if (min == null) return null;
  const range = max != null && max !== min;
  return (
    <span className={cn("font-bold tabular-nums text-text", className)}>
      {range ? `desde ${formatCop(min)}` : formatCop(min)}
    </span>
  );
}
