"use client";

import { useSyncExternalStore } from "react";

/** `matchMedia` como store externo (sin flash de hidratación: en servidor devuelve `false`). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
