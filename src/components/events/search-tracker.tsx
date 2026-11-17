"use client";

import { useEffect } from "react";
import { trackSearch, type SearchEvent } from "@/lib/events/client";

/** Registra una búsqueda cuando cambian el texto, los filtros, la pestaña o el orden (spec 003). */
export function SearchTracker(e: SearchEvent) {
  const key = JSON.stringify(e);
  useEffect(() => {
    trackSearch(JSON.parse(key) as SearchEvent);
  }, [key]);
  return null;
}
