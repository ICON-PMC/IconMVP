"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { CatalogComparison, ComparisonGarment } from "@/lib/catalog-runs";
import { archiveMissingAction, republishReappearedAction } from "./actions";
import { formatWhen } from "./format";

// Resultado de comparar la tienda con las prendas de la marca. Nada se archiva solo: el staff elige.
export function ComparisonPanel({ runId, comparison: initial }: { runId: string; comparison: CatalogComparison }) {
  const router = useRouter();
  const [cmp, setCmp] = useState(initial);
  const [pending, start] = useTransition();
  const [missingSel, setMissingSel] = useState<Set<string>>(new Set());
  const [backSel, setBackSel] = useState<Set<string>>(new Set());
  const [extraOk, setExtraOk] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  function archive() {
    start(async () => {
      const ids = [...missingSel];
      const res = await archiveMissingAction(runId, ids, cmp.high_missing_ratio && extraOk);
      setConfirmArchive(false);
      if (!res.ok) return void toast.error(res.error);
      setCmp((c) => ({ ...c, ya_no: c.ya_no.filter((g) => !ids.includes(g.garment_id)) }));
      setMissingSel(new Set());
      toast.success(`${res.changed} ${res.changed === 1 ? "prenda archivada" : "prendas archivadas"}. Salieron del feed.`);
      router.refresh();
    });
  }

  function republish() {
    start(async () => {
      const ids = [...backSel];
      const res = await republishReappearedAction(runId, ids);
      if (!res.ok) return void toast.error(res.error);
      setCmp((c) => ({ ...c, reaparecen: c.reaparecen.filter((g) => !ids.includes(g.garment_id)) }));
      setBackSel(new Set());
      toast.success(`${res.changed} ${res.changed === 1 ? "prenda vuelta a publicar" : "prendas vueltas a publicar"}.`);
      router.refresh();
    });
  }

  const archiveBlocked = !missingSel.size || (cmp.high_missing_ratio && !extraOk);

  return (
    <section className="space-y-4 text-sm" aria-label="Comparación con la tienda">
      <h3 className="text-base font-medium text-forest">Comparación con la tienda</h3>
      <ul className="flex flex-wrap gap-2 text-xs">
        <Pill label="Siguen" n={cmp.siguen.length} />
        <Pill label="Nuevas" n={cmp.nuevas.length} />
        <Pill label="Ya no aparecen" n={cmp.ya_no.length} tone={cmp.ya_no.length ? "warn" : undefined} />
        <Pill label="Reaparecen" n={cmp.reaparecen.length} />
        <Pill label="Sin enlace de compra" n={cmp.sin_url.length} />
      </ul>

      {/* Ya no aparecen */}
      <div className="space-y-2 rounded-xl bg-white/40 px-3 py-3">
        <p className="font-medium text-forest">Ya no aparecen en la tienda ({cmp.ya_no.length})</p>
        {cmp.ya_no.length === 0 ? (
          <p className="text-ink/60">Todas las prendas de la marca con enlace siguen en la tienda.</p>
        ) : (
          <>
            {cmp.high_missing_ratio && (
              <div role="alert" className="rounded-lg bg-coral/10 px-3 py-2 text-ink/80">
                <p className="font-medium text-coral">Más del 30 % del catálogo no apareció: podría ser un fallo de lectura.</p>
                <label className="mt-1 flex items-start gap-2">
                  <input type="checkbox" checked={extraOk} onChange={(e) => setExtraOk(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-forest" />
                  Revisé la tienda y confirmo que realmente ya no vende estas prendas.
                </label>
              </div>
            )}
            <Checklist
              items={cmp.ya_no}
              selected={missingSel}
              onToggle={(id) => toggle(missingSel, setMissingSel, id)}
              onAll={() => setMissingSel(missingSel.size === cmp.ya_no.length ? new Set() : new Set(cmp.ya_no.map((g) => g.garment_id)))}
            />
            <Button disabled={pending || archiveBlocked} onClick={() => setConfirmArchive(true)} className="rounded-full">
              Archivar seleccionadas ({missingSel.size})
            </Button>
            <p className="text-xs text-ink/50">Archivadas salen del feed, pero se pueden recuperar. Las que no elijas no cambian.</p>
          </>
        )}
      </div>

      {/* Reaparecen */}
      {cmp.reaparecen.length > 0 && (
        <div className="space-y-2 rounded-xl bg-white/40 px-3 py-3">
          <p className="font-medium text-forest">Reaparecen en la tienda ({cmp.reaparecen.length})</p>
          <p className="text-ink/60">Las archivó una lectura anterior y la tienda las vuelve a ofrecer.</p>
          <Checklist
            items={cmp.reaparecen}
            selected={backSel}
            onToggle={(id) => toggle(backSel, setBackSel, id)}
            onAll={() => setBackSel(backSel.size === cmp.reaparecen.length ? new Set() : new Set(cmp.reaparecen.map((g) => g.garment_id)))}
          />
          <Button disabled={pending || !backSel.size} onClick={republish} variant="outline" className="rounded-full">
            Volver a publicar ({backSel.size})
          </Button>
        </div>
      )}

      {cmp.nuevas.length > 0 && (
        <details className="rounded-xl bg-white/40 px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-ink/70">Nuevas en la tienda, aún no están en Icon ({cmp.nuevas.length})</summary>
          <p className="text-ink/60">Ya vienen en el Excel del paquete.</p>
          <ul className="mt-1 space-y-0.5 text-ink/70">{cmp.nuevas.map((n) => <li key={n.handle}>{n.title}</li>)}</ul>
        </details>
      )}
      {cmp.sin_url.length > 0 && (
        <details className="rounded-xl bg-white/40 px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-ink/70">Sin enlace de compra: no se pueden comparar ({cmp.sin_url.length})</summary>
          <ul className="mt-1 space-y-0.5 text-ink/70">{cmp.sin_url.map((g) => <li key={g.garment_id}>{g.title}</li>)}</ul>
        </details>
      )}

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`¿Archivar ${missingSel.size} ${missingSel.size === 1 ? "prenda" : "prendas"}?`}
        description="Salen del feed y de la búsqueda. Puedes recuperarlas si reaparecen en la tienda."
        confirmLabel="Archivar"
        onConfirm={archive}
      />
    </section>
  );
}

function Pill({ label, n, tone }: { label: string; n: number; tone?: "warn" }) {
  return (
    <li className={`rounded-full px-2.5 py-1 font-medium ${tone === "warn" ? "bg-coral/15 text-coral" : "bg-leaf-soft text-forest-deep"}`}>
      {label}: {n}
    </li>
  );
}

function Checklist({
  items,
  selected,
  onToggle,
  onAll,
}: {
  items: ComparisonGarment[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAll: () => void;
}) {
  return (
    <div>
      <button type="button" onClick={onAll} className="min-h-11 text-xs text-forest underline">
        {selected.size === items.length ? "Quitar selección" : "Seleccionar todas"}
      </button>
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {items.map((g) => (
          <li key={g.garment_id}>
            <label className="flex min-h-11 items-start gap-3 rounded-lg px-1 py-1.5 hover:bg-white/50">
              <input
                type="checkbox"
                checked={selected.has(g.garment_id)}
                onChange={() => onToggle(g.garment_id)}
                className="mt-0.5 size-5 shrink-0 accent-forest"
              />
              <span>
                <span className="text-ink">{g.title}</span>
                <span className="block text-xs text-ink/50">
                  {g.status === "published" ? "Publicada" : g.status === "pending" ? "Pendiente" : "Archivada"} ·{" "}
                  {g.last_seen_at ? `vista por última vez el ${formatWhen(g.last_seen_at)}` : "sin verificar"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
