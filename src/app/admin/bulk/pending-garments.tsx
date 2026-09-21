"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { StickyActionBar } from "@/components/sticky-action-bar";
import { useSelection } from "@/lib/use-selection";
import { cn } from "@/lib/utils";
import { uploadGarmentImageAction, deleteGarmentAction } from "./actions";

export type PendingItem = { id: string; title: string; subtitle: string };

const MAX_BYTES = 10 * 1024 * 1024; // coincide con serverActions.bodySizeLimit
const CONCURRENCY = 3;

type RowState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string };

export function PendingGarments({ items }: { items: PendingItem[] }) {
  const router = useRouter();
  const sel = useSelection(items.map((i) => i.id));
  const [files, setFiles] = useState<Record<string, File>>({});
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = progress !== null;

  const readyIds = items.filter((it) => files[it.id]).map((it) => it.id);

  function pick(id: string, file: File | undefined) {
    setFiles((prev) => {
      const next = { ...prev };
      if (file) next[id] = file;
      else delete next[id];
      return next;
    });
    setRows((prev) => ({ ...prev, [id]: { kind: "idle" } }));
  }

  /** Ejecuta `worker` sobre `ids` con concurrencia limitada, avanzando el "n de m". */
  async function runBatch(
    label: string,
    ids: string[],
    worker: (id: string) => Promise<string | null>,
  ) {
    setProgress({ label, done: 0, total: ids.length });
    let done = 0;
    const failedIds = new Set<string>();
    const queue = [...ids];
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, ids.length) }, async () => {
        for (let id = queue.shift(); id; id = queue.shift()) {
          const err = await worker(id);
          if (err) {
            failedIds.add(id);
            setRows((prev) => ({ ...prev, [id]: { kind: "error", message: err } }));
          }
          setProgress({ label, done: ++done, total: ids.length });
        }
      }),
    );
    setProgress(null);
    return { ok: ids.length - failedIds.size, failed: failedIds.size, failedIds };
  }

  async function uploadAll() {
    const byId = new Map(items.map((i) => [i.id, i]));
    const r = await runBatch("Subiendo", readyIds, async (id) => {
      const file = files[id];
      const title = byId.get(id)?.title ?? "prenda";
      if (file.size > MAX_BYTES) return "Imagen muy grande (máx. 10 MB).";
      setRows((prev) => ({ ...prev, [id]: { kind: "uploading" } }));
      try {
        const sub = new FormData();
        sub.set("garment_id", id);
        sub.set("image", file);
        const res = await uploadGarmentImageAction(sub);
        return res.ok ? null : (res.error ?? `No se pudo subir ${title}.`);
      } catch (e) {
        return e instanceof Error ? e.message : "Fallo de red/servidor.";
      }
    });
    // Las subidas correctas ya no están pendientes: salen de la lista al refrescar.
    setFiles((prev) => {
      const next = { ...prev };
      for (const id of readyIds) if (!r.failedIds.has(id)) delete next[id];
      return next;
    });
    if (r.failed) toast.warning(`${r.ok} publicada(s), ${r.failed} con error.`);
    else toast.success(`${r.ok} ${r.ok === 1 ? "foto subida y publicada" : "fotos subidas y publicadas"}.`);
    router.refresh();
  }

  async function deleteSelected() {
    const ids = [...sel.selected];
    const r = await runBatch("Eliminando", ids, async (id) => {
      const res = await deleteGarmentAction(id);
      return res.ok ? null : (res.error ?? "No se pudo eliminar.");
    });
    sel.clear();
    if (r.failed) toast.warning(`${r.ok} eliminada(s), ${r.failed} con error.`);
    else toast.success(`${r.ok} ${r.ok === 1 ? "prenda eliminada" : "prendas eliminadas"}.`);
    router.refresh();
  }

  if (!items.length)
    return <EmptyState title="No hay prendas pendientes de foto 🎉" />;

  const barLabel = busy
    ? `${progress.label} ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…`
    : sel.count
      ? `${sel.count} ${sel.count === 1 ? "seleccionada" : "seleccionadas"}`
      : `${readyIds.length} de ${items.length} con foto`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm text-ink/70">
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <Checkbox
            checked={sel.allSelected}
            disabled={busy}
            onCheckedChange={() => (sel.allSelected ? sel.clear() : sel.selectAll())}
            aria-label="Seleccionar todas"
          />
          Seleccionar todas
        </label>
        <span>{items.length} por completar</span>
      </div>

      <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white/50">
        {items.map((it) => {
          const file = files[it.id];
          const st = rows[it.id] ?? { kind: "idle" };
          return (
            <li key={it.id} className="flex items-start gap-3 px-3 py-3">
              <Checkbox
                checked={sel.isSelected(it.id)}
                disabled={busy}
                onCheckedChange={() => sel.toggle(it.id)}
                aria-label={`Seleccionar ${it.title}`}
                className="mt-1"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="truncate text-sm font-medium text-ink">{it.title}</p>
                  <p className="truncate text-xs text-ink/60">{it.subtitle}</p>
                </div>
                <FilePicker
                  file={file}
                  disabled={busy}
                  onPick={(f) => pick(it.id, f)}
                  state={st}
                />
                {st.kind === "error" && (
                  <p role="alert" className="text-xs text-coral">
                    {st.message}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <StickyActionBar label={barLabel}>
        {sel.count > 0 && !busy && (
          <>
            <Button type="button" variant="ghost" onClick={sel.clear} className="rounded-full">
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              className="rounded-full"
            >
              Eliminar {sel.count}
            </Button>
          </>
        )}
        <Button
          type="button"
          size="lg"
          disabled={busy || readyIds.length === 0}
          onClick={uploadAll}
          className="flex-1 rounded-full sm:flex-none sm:px-6"
        >
          {busy ? "Procesando…" : `Subir ${readyIds.length} ${readyIds.length === 1 ? "foto" : "fotos"}`}
        </Button>
      </StickyActionBar>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Eliminar ${sel.count} ${sel.count === 1 ? "prenda" : "prendas"}?`}
        description="Se borran de la base de datos con sus tallas y etiquetas. No se puede deshacer."
        onConfirm={deleteSelected}
      />
    </div>
  );
}

/** Selector de archivo con botón de 44 px (el `<input type=file>` nativo queda oculto). */
function FilePicker({
  file,
  disabled,
  onPick,
  state,
}: {
  file: File | undefined;
  disabled: boolean;
  onPick: (f: File | undefined) => void;
  state: RowState;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant={file ? "secondary" : "outline"}
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="rounded-full"
      >
        <ImageIcon data-icon="inline-start" /> {file ? "Cambiar" : "Elegir foto"}
      </Button>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-xs",
          state.kind === "error" ? "text-coral" : "text-ink/60",
        )}
      >
        {state.kind === "uploading" ? "Subiendo…" : file ? file.name : "Sin foto"}
      </span>
    </div>
  );
}
