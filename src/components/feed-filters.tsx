"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Opt = { value: string; label: string };
type Group = { param: string; label: string; options: Opt[] };

export function FeedFilters({ groups }: { groups: Group[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected = (param: string): string[] =>
    searchParams.get(param)?.split(",").filter(Boolean) ?? [];

  function toggle(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const cur = selected(param);
    const next = cur.includes(value)
      ? cur.filter((v) => v !== value)
      : [...cur, value];
    if (next.length) params.set(param, next.join(","));
    else params.delete(param);
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  function setQuery(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const v = value.trim();
    if (v) params.set("q", v);
    else params.delete("q");
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  const hasAny =
    groups.some((g) => selected(g.param).length > 0) ||
    !!searchParams.get("q");

  return (
    <div className="glass rounded-2xl p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setQuery(String(fd.get("q") ?? ""));
        }}
        className="mb-3"
      >
        <input
          key={searchParams.get("q") ?? ""}
          name="q"
          type="search"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Buscar marca o prenda…"
          aria-label="Buscar"
          className="glass-input w-full rounded-full px-4 py-2 text-sm text-ink placeholder:text-ink/40"
        />
      </form>
      <div className="flex flex-col gap-3">
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
