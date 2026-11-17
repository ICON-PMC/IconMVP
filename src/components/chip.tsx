"use client";

import Link from "next/link";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ChipVariant = "filter" | "tag" | "on-dark";

const BASE =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-label transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none";

function chipClass(variant: ChipVariant, selected: boolean) {
  if (variant === "tag") return "bg-surface-sunken text-text";
  if (variant === "on-dark")
    return selected ? "bg-text-inverse text-text" : "border-[1.5px] border-text-inverse/70 text-text-inverse";
  return selected
    ? "border-[1.5px] border-action bg-action text-action-ink"
    : "border-[1.5px] border-line-strong bg-transparent text-text hover:bg-surface-sunken";
}

/**
 * Chip en píldora (spec 007): filtro seleccionable, etiqueta o sobre fondo oscuro. Mide 36 px de
 * alto; el margen vertical (my-1) completa los 44 px de área táctil.
 */
export function Chip({
  variant = "filter",
  selected = false,
  count,
  onRemove,
  href,
  className,
  children,
  ...props
}: {
  variant?: ChipVariant;
  selected?: boolean;
  count?: number;
  onRemove?: () => void;
  href?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = cn(BASE, "my-1", chipClass(variant, selected), className);
  const inner = (
    <>
      <span className="truncate">{children}</span>
      {count != null && <span className="tabular-nums opacity-60">{count}</span>}
    </>
  );
  if (onRemove)
    return (
      <span className={cn(cls, "pr-1.5")}>
        {inner}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${typeof children === "string" ? children : "filtro"}`}
          className="-my-1 flex size-7 items-center justify-center rounded-full hover:bg-black/10"
        >
          <XIcon className="size-3.5" aria-hidden />
        </button>
      </span>
    );
  if (href)
    return (
      <Link href={href} className={cls} aria-current={selected ? "true" : undefined}>
        {inner}
      </Link>
    );
  if (variant === "tag") return <span className={cls}>{inner}</span>;
  return (
    <button type="button" aria-pressed={selected} className={cls} {...props}>
      {inner}
    </button>
  );
}
