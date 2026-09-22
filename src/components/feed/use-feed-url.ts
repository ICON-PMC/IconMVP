"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Estado del feed en la URL (?city=…&occasion=…&sort=…&q=…), compartido por la barra
// superior, el panel de filtros y los chips (de filtro activo y de sugerencia).
// `pending` (useTransition) deja que la UI marque "aplicando" sin bloquear la interacción.
export function useFeedUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function selected(param: string): string[] {
    return searchParams.get(param)?.split(",").filter(Boolean) ?? [];
  }

  function push(params: URLSearchParams) {
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function toggle(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const cur = selected(param);
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    if (next.length) params.set(param, next.join(","));
    else params.delete(param);
    push(params);
  }

  function remove(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const next = selected(param).filter((v) => v !== value);
    if (next.length) params.set(param, next.join(","));
    else params.delete(param);
    push(params);
  }

  // Reemplaza de una vez varios grupos de filtros (botón "Aplicar" del panel).
  function applyGroups(next: Record<string, string[]>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [param, values] of Object.entries(next)) {
      if (values.length) params.set(param, values.join(","));
      else params.delete(param);
    }
    push(params);
  }

  function setQuery(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const v = value.trim();
    if (v) params.set("q", v);
    else params.delete("q");
    push(params);
  }

  function setSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "relevant") params.set("sort", value);
    else params.delete("sort");
    push(params);
  }

  function clearFilters(paramsToKeep: string[] = []) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [...params.keys()]) {
      if (!paramsToKeep.includes(key)) params.delete(key);
    }
    push(params);
  }

  return {
    searchParams,
    pathname,
    selected,
    toggle,
    remove,
    applyGroups,
    setQuery,
    setSort,
    clearFilters,
    pending,
  };
}
