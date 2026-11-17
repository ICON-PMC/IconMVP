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
import { SlidersHorizontalIcon } from "lucide-react";
import { useFeedUrl } from "@/components/feed/use-feed-url";
import { CityMultiCombobox } from "@/components/city-combobox";
import { Chip } from "@/components/chip";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/use-media-query";

export type FilterGroup = {
  param: string;
  label: string;
  /** `swatch`: color de muestra (hex) para el grupo Color; `null` = multicolor/estampado. */
  options: { value: string; label: string; swatch?: string | null }[];
  /** Muchas opciones (ciudades): buscador con selección múltiple en vez de chips. */
  searchable?: boolean;
  /** Con `searchable`: estas opciones (las más usadas) se muestran además como chips. */
  featured?: string[];
};

// Muestra de color de un chip del grupo Color (sin `swatch` no se dibuja nada).
function Swatch({ color }: { color: string | null | undefined }) {
  if (color === undefined) return null;
  return (
    <span
      aria-hidden
      className="inline-block size-3.5 shrink-0 rounded-full border border-line"
      style={{
        background:
          color ?? "conic-gradient(#e8782a, #f2cf3a, #3e8e4e, #2f5da8, #6b3fa0, #d6247a, #e8782a)",
      }}
    />
  );
}

// Botón "Filtros (n)" + panel plegable (shadcn Sheet, cajón) con los 5 grupos.
// El panel trabaja sobre un borrador local; "Aplicar" lo escribe todo junto en la URL
// (evita una navegación por cada chip que se toca), "Limpiar" vacía el borrador.
export function FeedFilterPanel({ groups }: { groups: FilterGroup[] }) {
  const { selected, applyGroups, pending } = useFeedUrl();
  // Spec 007: hoja inferior en el celular, lateral en escritorio.
  const desktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string[]>>({});

  // Reinicia el borrador con lo que hay en la URL cada vez que se abre el panel.
  function handleOpenChange(next: boolean) {
    if (next)
      setDraft(
        Object.fromEntries(groups.map((g) => [g.param, selected(g.param)])),
      );
    setOpen(next);
  }

  const activeCount = groups.reduce((n, g) => n + selected(g.param).length, 0);

  function toggleDraft(param: string, value: string) {
    setDraft((prev) => {
      const cur = prev[param] ?? [];
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value];
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
        className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-line-strong px-4 text-sm font-semibold text-text outline-none hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-line-strong"
        data-testid="feed-filters-trigger"
      >
        <SlidersHorizontalIcon className="size-4" aria-hidden />
        Filtros
        {activeCount > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-action text-[11px] text-action-ink tabular-nums">
            {activeCount}
          </span>
        )}
      </SheetTrigger>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-sm"
      >
        {!desktop && <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line" aria-hidden />}
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>
            Ocasión, ciudad, precio, categoría, estilo y color.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
          {groups.map((g) => {
            const values = draft[g.param] ?? [];
            return (
              <div key={g.param}>
                <p className="mb-1 flex items-center gap-1.5 text-label text-text">
                  {g.label}
                  {values.length > 0 && (
                    <span className="rounded-full bg-surface-sunken px-1.5 tabular-nums">{values.length}</span>
                  )}
                </p>
                {g.searchable && g.featured?.length ? (
                  <div className="mb-1 flex flex-wrap gap-x-2">
                    {g.options
                      .filter((o) => g.featured!.includes(o.value))
                      .map((o) => (
                        <Chip key={o.value} selected={values.includes(o.value)} onClick={() => toggleDraft(g.param, o.value)}>
                          {o.label}
                        </Chip>
                      ))}
                  </div>
                ) : null}
                {g.searchable ? (
                  <CityMultiCombobox
                    label={g.label}
                    options={g.options}
                    placeholder={g.param === "city" ? undefined : `Busca un ${g.label.toLowerCase()}`}
                    emptyText={g.param === "city" ? undefined : "No hay prendas con ese filtro todavía."}
                    value={values}
                    onValueChange={(next) =>
                      setDraft((prev) => ({ ...prev, [g.param]: next }))
                    }
                  />
                ) : (
                  <div className="flex flex-wrap gap-x-2">
                    {g.options.map((o) => (
                      <Chip key={o.value} selected={values.includes(o.value)} onClick={() => toggleDraft(g.param, o.value)}>
                        <span className="flex items-center gap-1.5">
                          <Swatch color={o.swatch} />
                          {o.label}
                        </span>
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <SheetFooter className="flex-row gap-2 border-t border-line pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="secondary" className="flex-1" onClick={clearDraft}>
            Limpiar
          </Button>
          <Button type="button" className="flex-1" onClick={apply} loading={pending}>
            Ver resultados
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
