"use client";

import { useFeedUrl } from "@/components/feed/use-feed-url";
import { FeedFilterPanel, type FilterGroup } from "@/components/feed/filter-panel";

const SORT_OPTS = [
  { value: "relevant", label: "Relevante" },
  { value: "new", label: "Novedad" },
  { value: "popular", label: "Popularidad" },
  { value: "az", label: "A–Z" },
] as const;

// Barra superior del feed: búsqueda, botón "Filtros (n)" (abre el panel plegable) y orden.
export function FeedTopBar({ groups, sort }: { groups: FilterGroup[]; sort: string }) {
  const { searchParams, setQuery, setSort } = useFeedUrl();

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setQuery(String(fd.get("q") ?? ""));
        }}
        className="flex-1"
      >
        <input
          key={searchParams.get("q") ?? ""}
          name="q"
          type="search"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Buscar prendas, outfits, marcas…"
          aria-label="Buscar"
          className="glass-input w-full rounded-full px-4 py-2 text-sm text-ink placeholder:text-ink/40"
        />
      </form>
      <div className="flex items-center gap-2">
        <FeedFilterPanel groups={groups} />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Ordenar por"
          className="glass-input rounded-full px-3 py-2 text-sm text-ink/80"
        >
          {SORT_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              Ordenar: {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
