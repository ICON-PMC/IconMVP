"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useFeedUrl } from "@/components/feed/use-feed-url";

export type FilterGroup = {
  param: string;
  label: string;
  options: { value: string; label: string }[];
};

// Botón "Filtros (n)" + panel plegable (shadcn Sheet, cajón) con los 5 grupos.
// El panel trabaja sobre un borrador local; "Aplicar" lo escribe todo junto en la URL
// (evita una navegación por cada chip que se toca), "Limpiar" vacía el borrador.
export function FeedFilterPanel({ groups }: { groups: FilterGroup[] }) {
  const { selected, applyGroups, pending } = useFeedUrl();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string[]>>({});

  // Reinicia el borrador con lo que hay en la URL cada vez que se abre el panel.
  function handleOpenChange(next: boolean) {
    if (next) setDraft(Object.fromEntries(groups.map((g) => [g.param, selected(g.param)])));
    setOpen(next);
  }

  const activeCount = groups.reduce((n, g) => n + selected(g.param).length, 0);

  function toggleDraft(param: string, value: string) {
    setDraft((prev) => {
      const cur = prev[param] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...prev, [param]: next };
    });
  }

  function apply() {
    applyGroups(draft);
    setOpen(false);
  }

  function clearDraft() {
    setDraft(Object.fromEntries(groups.map((g) => [g.param, []])));
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        className="glass-input rounded-full px-4 py-2 text-sm font-medium text-ink/80 hover:bg-white/70"
        data-testid="feed-filters-trigger"
      >
        Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Ocasión, ciudad, precio, categoría y estilo.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
          {groups.map((g) => {
            const values = draft[g.param] ?? [];
            return (
              <div key={g.param}>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink/50">
                  {g.label}
                  {values.length > 0 && (
                    <span className="rounded-full bg-forest/10 px-1.5 text-forest">
                      {values.length}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map((o) => {
                    const active = values.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => toggleDraft(g.param, o.value)}
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
            );
          })}
        </div>
        <SheetFooter className="flex-row gap-2 border-t border-black/5">
          <button
            type="button"
            onClick={clearDraft}
            className="flex-1 rounded-full px-4 py-2 text-sm font-medium text-coral hover:bg-coral/10"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={pending}
            className="flex-1 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep disabled:opacity-60"
          >
            {pending ? "Aplicando…" : "Aplicar"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
