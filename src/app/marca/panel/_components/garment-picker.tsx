"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { R2Image } from "@/components/r2-image";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Input } from "@/components/ui/input";
import { formatCop } from "@/lib/taxonomy";

export type PickerGarment = { id: string; title: string; priceCop: number | null; image: string | null };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Hoja para elegir una prenda publicada del catálogo propio (spec 010, "Es esta de mi catálogo"). */
export function GarmentPicker({
  open,
  onOpenChange,
  garments,
  initialQuery,
  onPick,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  garments: PickerGarment[];
  initialQuery: string;
  onPick: (g: PickerGarment) => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = norm(query.trim());
  const visible = useMemo(() => (q ? garments.filter((g) => norm(g.title).includes(q)) : garments), [garments, q]);
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="¿Cuál de tus prendas es?" description={`Propuesta: ${initialQuery}`}>
      <label className="relative mb-3 block">
        <span className="sr-only">Buscar en tu catálogo</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en tu catálogo" className="pl-9" />
      </label>
      {visible.length ? (
        <ul className="flex flex-col gap-2">
          {visible.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onPick(g)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-card)] bg-surface-raised p-2 text-left ring-1 ring-line hover:bg-surface-sunken disabled:opacity-60"
              >
                <span className="size-14 shrink-0 overflow-hidden rounded-[var(--radius-field)] bg-surface-sunken">
                  <R2Image image={g.image} alt="" sizes="56px" className="size-full object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-text">{g.title}</span>
                  {g.priceCop != null && <span className="text-[13px] text-text-muted">{formatCop(g.priceCop)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-text-muted">
          {garments.length ? "No hay prendas con ese nombre." : "Aún no tienes prendas publicadas. Usa «Agregar a mi catálogo»."}
        </p>
      )}
    </ResponsiveSheet>
  );
}
