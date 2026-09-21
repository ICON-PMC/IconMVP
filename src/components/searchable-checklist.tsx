"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ChecklistOption = { id: string; label: string; hint?: string };

/**
 * Lista con búsqueda y casillas para elegir varios elementos de una lista larga (prendas, etc.).
 * Controlada por `selected`/`onChange`; si se pasa `name`, emite un `<input type="hidden">`
 * por id elegido, para usarla dentro de `<form action={serverAction}>`.
 */
export function SearchableChecklist({
  options,
  selected,
  onChange,
  name,
  searchLabel = "Buscar",
  emptyText = "Sin resultados.",
  className,
}: {
  options: ChecklistOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  name?: string;
  searchLabel?: string;
  emptyText?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const chosen = useMemo(() => new Set(selected), [selected]);
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const visible = useMemo(() => {
    const n = norm(q.trim());
    return n ? options.filter((o) => norm(o.label).includes(n)) : options;
  }, [options, q]);

  function toggle(id: string) {
    onChange(chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/40"
        />
        <Input
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>
      {visible.length ? (
        <ul className="max-h-72 divide-y divide-ink/10 overflow-y-auto rounded-2xl bg-white/50">
          {visible.map((o) => (
            <li key={o.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-white/60">
                <Checkbox checked={chosen.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-ink/60">{o.hint}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-sm text-ink/60">{emptyText}</p>
      )}
      {name && selected.map((id) => <input key={id} type="hidden" name={name} value={id} />)}
    </div>
  );
}
