"use client";

import { useRef, type ReactNode } from "react";
import { useImpression } from "@/lib/events/use-impressions";
import type { ImpressionEvent } from "@/lib/events/client";

/** Envoltorio que registra la impresión de una tarjeta (spec 003). Sin `event`, no mide nada. */
export function Tracked({ event, children }: { event: ImpressionEvent | null; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useImpression(ref, event);
  return <div ref={ref}>{children}</div>;
}
