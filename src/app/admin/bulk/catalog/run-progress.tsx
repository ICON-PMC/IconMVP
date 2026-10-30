"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdvanceResult, RunSummary } from "@/lib/catalog-runs";
import { advanceCatalogRun, discardCatalogRun } from "./actions";
import { ComparisonPanel } from "./comparison-panel";

type Progress = { label: string; current: number; total: number | null };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Repite tandas del servidor hasta terminar. El estado vive en la base: si se cierra la pestaña,
// la corrida queda retomable (el panel ofrece Continuar / Empezar de nuevo).
export function RunProgress({
  runId,
  initialWarnings = [],
  onClose,
}: {
  runId: string;
  initialWarnings?: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>({ label: "Empezando…", current: 0, total: null });
  const [warnings, setWarnings] = useState<string[]>(initialWarnings);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [busyDiscard, setBusyDiscard] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    let cancelled = false;
    started.current = true;
    (async () => {
      let retries = 0;
      while (!cancelled) {
        let res: AdvanceResult;
        try {
          res = await advanceCatalogRun(runId);
        } catch {
          res = { ok: false, error: "Se perdió la conexión con el servidor.", retryable: true };
        }
        if (cancelled) return;
        if (!res.ok) {
          if (res.retryable && retries < 3) {
            retries++;
            setProgress((p) => ({ ...p, label: "Reintentando…" }));
            await wait(2500 * retries);
            continue;
          }
          setError(res.error);
          return;
        }
        retries = 0;
        setProgress(res.progress);
        if (res.warnings.length) setWarnings((prev) => [...new Set([...prev, ...res.warnings])]);
        if (res.done) {
          setSummary(res.summary ?? null);
          toast.success("El paquete está listo para descargar.");
          router.refresh();
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, router]);

  async function restart() {
    setBusyDiscard(true);
    await discardCatalogRun(runId);
    setBusyDiscard(false);
    router.refresh();
    onClose();
  }

  const pct = progress.total ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : null;

  if (error)
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
          {error}
        </p>
        <Button onClick={restart} disabled={busyDiscard} variant="outline" className="rounded-full">
          Empezar de nuevo
        </Button>
      </div>
    );

  if (summary) return <RunDone runId={runId} summary={summary} warnings={warnings} onClose={onClose} />;

  return (
    <div className="space-y-3" aria-live="polite">
      <p className="text-sm font-medium text-forest">
        {progress.label}
        {progress.total != null && ` ${progress.current} de ${progress.total}`}
        {progress.total == null && progress.current > 0 && ` (${progress.current} prendas leídas)`}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-label="Avance de la lectura"
        className="h-2.5 overflow-hidden rounded-full bg-white/50"
      >
        <div
          className={`h-full rounded-full bg-forest transition-all ${pct == null ? "w-1/3 animate-pulse" : ""}`}
          style={pct != null ? { width: `${pct}%` } : undefined}
        />
      </div>
      <p className="text-xs text-ink/60">
        Se lee la tienda con pausas para no saturarla. Puedes cerrar esta página: la lectura queda guardada y podrás continuarla.
      </p>
      {warnings.length > 0 && <Warnings items={warnings} />}
      <Button onClick={restart} disabled={busyDiscard} variant="ghost" size="sm" className="rounded-full">
        Cancelar y empezar de nuevo
      </Button>
    </div>
  );
}

function Warnings({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 rounded-xl bg-coral/10 px-3 py-2 text-sm text-ink/80">
      {items.map((w) => (
        <li key={w}>⚠ {w}</li>
      ))}
    </ul>
  );
}

function RunDone({
  runId,
  summary,
  warnings,
  onClose,
}: {
  runId: string;
  summary: RunSummary;
  warnings: string[];
  onClose: () => void;
}) {
  const s = summary.stats;
  const unknown = Object.entries(summary.unknownSizes);
  return (
    <div className="space-y-4 text-sm">
      <p role="status" className="rounded-xl bg-leaf-soft px-3 py-2 text-forest-deep">
        ✓ {s ? `${s.products} prendas leídas y ${s.photos} fotos descargadas.` : "Paquete listo."} Todavía no se creó nada en Icon.
      </p>

      <Button
        nativeButton={false}
        render={<a href={`/admin/bulk/catalog/${runId}/paquete`} />}
        className="w-full rounded-full sm:w-auto sm:px-6"
      >
        <DownloadIcon data-icon="inline-start" /> Descargar paquete (Excel + fotos)
      </Button>

      <p className="rounded-xl bg-white/40 px-3 py-2 text-ink/80">
        <b>Etiquetas sugeridas automáticamente.</b> Revisa la categoría, el color, el estilo, la ocasión y el clima en el Excel antes
        de importar: no siempre son acertadas. Luego sube el Excel y la carpeta <code>fotos</code> de una sola vez abajo.
      </p>

      {s && (
        <ul className="grid gap-1 text-ink/80 sm:grid-cols-2">
          <li>Sin categoría: {s.no_category}</li>
          <li>Sin talla: {s.no_size}</li>
          <li>Sin precio: {s.no_price}</li>
          <li>Sin foto: {s.no_photo}</li>
          <li>Con estilo sugerido: {s.with_style}</li>
          <li>Con ocasión sugerida: {s.with_occasion}</li>
        </ul>
      )}

      {summary.currency && summary.currency !== "COP" && (
        <p className="rounded-xl bg-coral/10 px-3 py-2 text-coral">
          La tienda reporta precios en {summary.currency}, no en COP. Corrige <code>precio_cop</code> antes de importar.
        </p>
      )}
      {!summary.currency && (
        <p className="rounded-xl bg-white/40 px-3 py-2 text-ink/70">Confirma que los precios estén en COP: se copian tal cual vienen.</p>
      )}
      {unknown.length > 0 && (
        <p className="rounded-xl bg-coral/10 px-3 py-2 text-ink/80">
          Tallas que no existen en Icon (se omitirán al importar): {unknown.map(([t, c]) => `${t} (${c})`).join(", ")}.
        </p>
      )}
      {warnings.length > 0 && <Warnings items={warnings} />}

      {summary.comparison && <ComparisonPanel runId={runId} comparison={summary.comparison} />}

      {summary.rows.length > 0 && (
        <details className="rounded-xl bg-white/40 px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-ink/70">
            Prendas con avisos para revisar ({summary.rows.length})
          </summary>
          <ul className="mt-2 space-y-1 text-ink/70">
            {summary.rows.map((r, i) => (
              <li key={i}>
                <b>{r.title}</b>: {r.notes.join("; ")}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Button onClick={onClose} variant="outline" className="rounded-full">
        Leer otro catálogo
      </Button>
    </div>
  );
}
