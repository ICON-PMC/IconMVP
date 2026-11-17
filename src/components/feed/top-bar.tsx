"use client";

import { SearchIcon } from "lucide-react";

import { useFeedUrl } from "@/components/feed/use-feed-url";
import { FeedFilterPanel, type FilterGroup } from "@/components/feed/filter-panel";
import { CameraButton } from "@/components/visual/camera-button";

const SORT_OPTS = [
  { value: "relevant", label: "Relevante" },
  { value: "new", label: "Novedad" },
  { value: "popular", label: "Popularidad" },
  { value: "az", label: "A–Z" },
] as const;

// Barra superior del feed: búsqueda, botón "Filtros (n)" (abre el panel plegable) y orden.
export function FeedTopBar({
  groups,
  sort,
  isLoggedIn = false,
  extraSorts = [],
}: {
  groups: FilterGroup[];
  sort: string;
  isLoggedIn?: boolean;
  /** Órdenes propios de una pestaña (p. ej. "Mejor valoradas" en Marcas, spec 011). */
  extraSorts?: { value: string; label: string }[];
}) {
  const { searchParams, setQuery, setSort } = useFeedUrl();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setQuery(String(fd.get("q") ?? ""));
        }}
        className="field flex flex-1 items-center gap-2 rounded-full! pr-1.5 pl-4"
        role="search"
      >
        <SearchIcon className="size-4 shrink-0 text-text-muted" aria-hidden />
        <input
          key={searchParams.get("q") ?? ""}
          // "Buscar" de la barra inferior (spec 007): llega con ?buscar=1 y enfoca el campo.
          autoFocus={searchParams.get("buscar") === "1"}
          name="q"
          type="search"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Buscar prendas, outfits, marcas…"
          aria-label="Buscar"
          className="h-11 w-full min-w-0 bg-transparent text-base text-text outline-none placeholder:text-text-muted md:text-[15px]"
        />
        <CameraButton
          isLoggedIn={isLoggedIn}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-text hover:bg-surface-sunken"
        />
      </form>
      <div className="flex items-center gap-2">
        <FeedFilterPanel groups={groups} />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Ordenar por"
          className="min-h-11 rounded-full border-[1.5px] border-line-strong bg-transparent px-3 text-sm font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
        >
          {[...SORT_OPTS, ...extraSorts].map((o) => (
            <option key={o.value} value={o.value}>
              Ordenar: {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
