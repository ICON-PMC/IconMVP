"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatWhen } from "./format";
import { ComparisonPanel } from "./comparison-panel";
import type { CatalogComparison } from "@/lib/catalog-runs";

export type RunListItem = {
  id: string;
  brandName: string;
  sourceKind: "shop" | "csv";
  sourceLabel: string;
  consentConfirmed: boolean;
  phase: string;
  createdAt: string;
  expired: boolean; // calculado en el servidor (el render no puede leer la hora)
  createdByName: string;
  isComplete: boolean;
  error: string | null;
  stats: { products?: number; photos?: number } | null;
  importedAt: string | null;
  importedByName: string | null;
  importStats: {
    created?: number;
    skipped_existing?: number;
    photos_matched?: number;
    photos_unmatched?: number;
    garments_without_photo?: number;
  } | null;
  actions: { type: "archive" | "republish"; at: string; count: number }[];
  // Solo si quedan prendas por resolver («ya no aparecen» o «reaparecen») y la corrida sigue vigente.
  comparison: CatalogComparison | null;
};


const PHASE: Record<string, { label: string; cls: string }> = {
  done: { label: "Lista", cls: "bg-leaf-soft text-forest-deep" },
  reading: { label: "En curso", cls: "bg-honey-soft text-ink/80" },
  photos: { label: "En curso", cls: "bg-honey-soft text-ink/80" },
  building: { label: "En curso", cls: "bg-honey-soft text-ink/80" },
  failed: { label: "Falló", cls: "bg-coral/15 text-coral" },
  discarded: { label: "Descartada", cls: "bg-ink/10 text-ink/70" },
};

export function RunsList({ runs }: { runs: RunListItem[] }) {
  if (!runs.length)
    return <p className="text-sm text-ink/60">Todavía no se ha leído ningún catálogo desde el panel.</p>;
  return (
    <ul className="space-y-3">
      {runs.map((r) => {
        const expired = r.expired;
        const phase = expired && r.phase !== "discarded" && r.phase !== "failed" ? { label: "Vencida", cls: "bg-ink/10 text-ink/70" } : (PHASE[r.phase] ?? PHASE.reading);
        const canDownload = r.phase === "done" && !expired;
        return (
          <li key={r.id} className="rounded-xl bg-white/40 px-3 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-forest">{r.brandName}</span>
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", phase.cls)}>{phase.label}</span>
              <span className="text-ink/60">{formatWhen(r.createdAt)}</span>
            </div>
            <dl className="mt-1.5 grid gap-x-4 gap-y-0.5 text-ink/70 sm:grid-cols-2">
              <div>
                <dt className="inline text-ink/50">Responsable: </dt>
                <dd className="inline">{r.createdByName}</dd>
              </div>
              <div>
                <dt className="inline text-ink/50">Fuente: </dt>
                <dd className="inline break-all">{r.sourceKind === "shop" ? "Tienda" : "CSV"} · {r.sourceLabel}</dd>
              </div>
              <div>
                <dt className="inline text-ink/50">Consentimiento: </dt>
                <dd className="inline">{r.consentConfirmed ? "confirmado ✓" : "sin confirmar"}</dd>
              </div>
              {r.stats && (
                <div>
                  <dt className="inline text-ink/50">Leído: </dt>
                  <dd className="inline">
                    {r.stats.products ?? 0} {r.stats.products === 1 ? "prenda" : "prendas"} · {r.stats.photos ?? 0} {r.stats.photos === 1 ? "foto" : "fotos"}
                    {r.sourceKind === "shop" && ` · lectura ${r.isComplete ? "completa" : "parcial"}`}
                  </dd>
                </div>
              )}
            </dl>
            {r.error && <p className="mt-1.5 text-coral">{r.error}</p>}
            {r.importedAt && (
              <p className="mt-1.5 rounded-lg bg-leaf-soft/70 px-2 py-1 text-forest-deep">
                Importada el {formatWhen(r.importedAt)}
                {r.importedByName ? ` por ${r.importedByName}` : ""}: {r.importStats?.created ?? 0} creadas
                {(r.importStats?.skipped_existing ?? 0) > 0 && `, ${r.importStats?.skipped_existing} ya existían`}
                {r.importStats?.photos_matched != null && ` · ${r.importStats.photos_matched} fotos subidas`}
                {(r.importStats?.garments_without_photo ?? 0) > 0 && ` · ${r.importStats?.garments_without_photo} prendas sin foto`}
                {(r.importStats?.photos_unmatched ?? 0) > 0 && ` · ${r.importStats?.photos_unmatched} fotos sin prenda`}.
              </p>
            )}
            {r.actions.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-ink/70">
                {r.actions.map((a, i) => (
                  <li key={i}>
                    {a.type === "archive" ? "Archivó" : "Volvió a publicar"} {a.count} prenda(s) el {formatWhen(a.at)}
                  </li>
                ))}
              </ul>
            )}
            {r.comparison && (
              <details className="mt-2 rounded-lg bg-white/50 px-3 py-1">
                <summary className="min-h-11 cursor-pointer py-2 font-medium text-forest">
                  Comparación con la tienda · {r.comparison.ya_no.length} ya no aparecen
                  {r.comparison.reaparecen.length > 0 && ` · ${r.comparison.reaparecen.length} reaparecen`}
                </summary>
                <div className="pb-3">
                  <ComparisonPanel runId={r.id} comparison={r.comparison} />
                </div>
              </details>
            )}
            {canDownload && (
              <Button
                nativeButton={false}
                render={<a href={`/admin/bulk/catalog/${r.id}/paquete`} />}
                variant="outline"
                size="sm"
                className="mt-2 rounded-full"
              >
                <DownloadIcon data-icon="inline-start" /> Descargar paquete
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
