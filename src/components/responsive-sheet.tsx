"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/** Hoja inferior en móvil, lateral desde `md`. Cuerpo con scroll; `footer` queda fijo abajo. */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const desktop = useMediaQuery("(min-width: 768px)");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className={cn(!desktop && "max-h-[88dvh] rounded-t-3xl", "gap-0 p-0")}
      >
        <SheetHeader className="px-4 pt-5 pb-3">
          <SheetTitle className="text-lg text-forest">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer && (
          <div className="border-t border-ink/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
