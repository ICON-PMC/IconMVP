"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Opt = { value: string; label: string };
type Group = { param: string; label: string; options: Opt[] };

const SORT_OPTS: Opt[] = [
  { value: "relevant", label: "Relevante" },
  { value: "new", label: "Novedad" },
  { value: "popular", label: "Popularidad" },
  { value: "az", label: "A–Z" },
];

export function FeedFilters({
  groups,
  sort = "relevant",
}: {
  groups: Group[];
  sort?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected = (param: string): string[] =>
    searchParams.get(param)?.split(",").filter(Boolean) ?? [];

  function push(params: URLSearchParams) {
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  function toggle(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const cur = selected(param);
    const next = cur.includes(value)
      ? cur.filter((v) => v !== value)
      : [...cur, value];
    if (next.length) params.set(param, next.join(","));
    else params.delete(param);
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

  const hasAny =
    groups.some((g) => selected(g.param).length > 0) ||
    !!searchParams.get("q") ||
    !!searchParams.get("sort");

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
            placeholder="Buscar prenda, marca…"
            aria-label="Buscar"
            className="glass-input w-full rounded-full px-4 py-2 text-sm text-ink placeholder:text-ink/40"
          />
        </form>
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

      <div className="mt-3 flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.param}>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink/50">
              {g.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.options.map((o) => {
                const active = selected(g.param).includes(o.value);
                return (
                  <button
                    key={o.value}
                    onClick={() => toggle(g.param, o.value)}
                    className={
                      active
                        ? "rounded-full bg-forest px-3 py-1 text-xs font-medium text-white"
                        : "glass-input rounded-full px-3 py-1 text-xs text-ink/80 hover:bg-white/70"
                    }
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {hasAny && (
        <button
          onClick={() => router.push(pathname)}
          className="mt-3 text-xs font-medium text-coral hover:underline"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
