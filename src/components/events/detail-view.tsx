"use client";

import { useEffect } from "react";
import { trackView, type ItemKind } from "@/lib/events/client";

/** Registra una vista de detalle al montar la ficha (spec 003). No pinta nada. */
export function DetailView({ itemKind, itemId }: { itemKind: ItemKind; itemId: string }) {
  useEffect(() => {
    trackView({ itemKind, itemId });
  }, [itemKind, itemId]);
  return null;
}
