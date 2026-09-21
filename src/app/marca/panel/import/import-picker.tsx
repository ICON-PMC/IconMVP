"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StickyActionBar } from "@/components/sticky-action-bar";
import { useSelection } from "@/lib/use-selection";
import { cn } from "@/lib/utils";
import { importInstagramMedia, type IgMediaOption } from "../actions";

export function ImportPicker({ items }: { items: IgMediaOption[] }) {
  const router = useRouter();
  const sel = useSelection(items.map((i) => i.id));
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const busy = progress !== null;

  async function importSelected() {
    const chosen = items.filter((it) => sel.isSelected(it.id));
    if (!chosen.length) return;
    setErrors([]);
    const errs: string[] = [];
    let created = 0;

    // Una foto por llamada: así el avance "n de m" es real y un fallo no frena el resto.
    for (let i = 0; i < chosen.length; i++) {
      setProgress({ done: i, total: chosen.length });
      const it = chosen[i];
      try {
        const r = await importInstagramMedia([
          { id: it.id, caption: it.caption, imageUrl: it.imageUrl },
        ]);
        if (!r.ok) errs.push(r.error);
        else {
          created += r.created;
          errs.push(...r.errors);
        }
      } catch (e) {
        errs.push(`${it.id}: ${e instanceof Error ? e.message : "fallo de red/servidor"}`);
      }
    }

    setProgress(null);
    setErrors(errs);
    sel.clear();
    if (errs.length) toast.warning(`${created} importada(s), ${errs.length} con error.`);
    else toast.success(`${created} ${created === 1 ? "foto importada" : "fotos importadas"} como borrador.`);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ink/70">{items.length} fotos disponibles</p>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={sel.allSelected ? sel.clear : sel.selectAll}
          className="rounded-full"
        >
          {sel.allSelected ? "Quitar selección" : "Seleccionar todas"}
        </Button>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="mb-4 space-y-1 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((it) => {
          const on = sel.isSelected(it.id);
          return (
            <li key={it.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={it.caption ? `Foto: ${it.caption.slice(0, 60)}` : "Foto de Instagram"}
                disabled={busy}
                onClick={() => sel.toggle(it.id)}
                className={cn(
                  "relative block w-full overflow-hidden rounded-2xl border-2 text-left transition focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                  on ? "border-forest" : "border-transparent",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.imageUrl} alt="" className="aspect-square w-full object-cover" />
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-2 right-2 flex size-7 items-center justify-center rounded-full border",
                    on ? "border-forest bg-forest text-white" : "border-white/80 bg-white/70 text-transparent",
                  )}
                >
                  <CheckIcon className="size-4" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {(sel.count > 0 || busy) && (
        <StickyActionBar
          label={
            busy
              ? `Importando ${progress.done + 1} de ${progress.total}…`
              : `${sel.count} ${sel.count === 1 ? "seleccionada" : "seleccionadas"}`
          }
        >
          {!busy && (
            <Button type="button" variant="ghost" onClick={sel.clear} className="rounded-full">
              Cancelar
            </Button>
          )}
          <Button
            type="button"
            size="lg"
            disabled={busy}
            onClick={importSelected}
            className="flex-1 rounded-full sm:flex-none sm:px-8"
          >
            {busy ? "Importando…" : `Importar ${sel.count}`}
          </Button>
        </StickyActionBar>
      )}
    </div>
  );
}
