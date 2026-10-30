"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { importGarments, uploadGarmentImageAction, type ImportResult } from "./actions";
import { reportPhotoImport } from "./catalog/actions";
import { matchPhotos, type MatchResult } from "./photo-matching";

const MAX_BYTES = 10 * 1024 * 1024; // coincide con serverActions.bodySizeLimit
const CONCURRENCY = 3;

type Outcome = {
  import: NonNullable<ImportResult>;
  match: MatchResult | null;
  uploaded: number;
  quota: { name: string; message: string }[];
  failed: { name: string; message: string }[];
};

// Excel + carpeta de fotos en una sola acción: el servidor crea las prendas (sin duplicar) y el navegador
// sube cada foto a su prenda, de a 3, respetando la cuota de la marca.
export function ImportPackageForm() {
  const router = useRouter();
  const [xlsx, setXlsx] = useState<File | null>(null);
  const [folder, setFolder] = useState<File[]>([]);
  const [extra, setExtra] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const files = [...folder, ...extra];
  const imageCount = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(f.name)).length;

  async function run() {
    if (!xlsx) return;
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      setStage("Creando las prendas…");
      const fd = new FormData();
      fd.set("file", xlsx);
      const res = await importGarments(null, fd);
      if (!res) throw new Error("Respuesta inesperada del servidor.");
      if (res.error) {
        setError(res.error);
        return;
      }

      const out: Outcome = { import: res, match: null, uploaded: 0, quota: [], failed: [] };
      if (files.length && res.photos.length) {
        const match = matchPhotos(files, res.photos);
        out.match = match;
        const queue = [...match.matched];
        let done = 0;
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
            for (let job = queue.shift(); job; job = queue.shift()) {
              setStage(`Subiendo fotos ${Math.min(done + 1, match.matched.length)} de ${match.matched.length}…`);
              const name = job.file.name;
              if (job.file.size > MAX_BYTES) {
                out.failed.push({ name, message: "Imagen muy grande (máx. 10 MB)." });
              } else {
                try {
                  const sub = new FormData();
                  sub.set("garment_id", job.garmentId);
                  sub.set("image", job.file);
                  sub.set("strict_quota", "1");
                  const r = await uploadGarmentImageAction(sub);
                  if (r.ok) out.uploaded++;
                  else if (r.code === "quota") out.quota.push({ name, message: r.error ?? "Cuota de almacenamiento alcanzada." });
                  else out.failed.push({ name, message: r.error ?? "No se pudo subir." });
                } catch (e) {
                  out.failed.push({ name, message: e instanceof Error ? e.message : "Fallo de red/servidor." });
                }
              }
              done++;
            }
          }),
        );
      } else if (files.length) {
        out.match = matchPhotos(files, []);
      }

      // Deja constancia en la corrida de origen (si el Excel la traía) de qué pasó con las fotos.
      if (res.runId) {
        await reportPhotoImport(res.runId, {
          photos_matched: out.uploaded,
          photos_unmatched: out.match?.filesWithoutGarment.length ?? 0,
          garments_without_photo: res.photos.length - out.uploaded,
        }).catch(() => undefined);
      }

      setOutcome(out);
      const bits = [`${res.created} prenda(s) creada(s)`];
      if (out.uploaded) bits.push(`${out.uploaded} foto(s) subida(s)`);
      toast.success(bits.join(" · "));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  const titleByLine = new Map(outcome?.import.results.map((r) => [r.line, r.title]) ?? []);

  return (
    <div className="space-y-4">
      <Button
        nativeButton={false}
        render={<a href="/admin/bulk/template" />}
        variant="outline"
        className="w-full rounded-full sm:w-auto"
      >
        <DownloadIcon data-icon="inline-start" /> Descargar plantilla Excel
      </Button>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Excel (.xlsx)" htmlFor="pkg-xlsx" hint="La plantilla completada o el catalogo.xlsx del paquete, ya revisado.">
          <Input
            id="pkg-xlsx"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setXlsx(e.target.files?.[0] ?? null)}
            className="h-auto min-h-11 py-2"
          />
        </FormField>
        <FormField
          label="Carpeta de fotos"
          htmlFor="pkg-folder"
          hint={files.length ? `${imageCount} foto(s) seleccionada(s).` : "Elige la carpeta «fotos» completa. Se emparejan por el nombre de archivo de la columna «foto»."}
        >
          <Input
            id="pkg-folder"
            ref={folderRef}
            type="file"
            multiple
            // @ts-expect-error webkitdirectory no está en los tipos de React, pero lo soportan todos los navegadores
            webkitdirectory=""
            onChange={(e) => setFolder(Array.from(e.target.files ?? []))}
            className="h-auto min-h-11 py-2"
          />
        </FormField>
      </div>

      <details className="rounded-xl bg-white/30 px-3 py-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 text-ink/70">¿Desde el celular? Elige las fotos una por una</summary>
        <div className="pb-2">
          <Input
            type="file"
            accept="image/*"
            multiple
            aria-label="Fotos sueltas"
            onChange={(e) => setExtra(Array.from(e.target.files ?? []))}
            className="h-auto min-h-11 py-2"
          />
        </div>
      </details>

      <Button type="button" onClick={run} disabled={busy || !xlsx} className="w-full rounded-full sm:w-auto sm:px-6">
        {busy ? stage || "Importando…" : "Importar prendas y fotos"}
      </Button>

      {error && (
        <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      {outcome && <Summary outcome={outcome} titleByLine={titleByLine} />}
    </div>
  );
}

function Summary({ outcome, titleByLine }: { outcome: Outcome; titleByLine: Map<number, string> }) {
  const { import: imp, match } = outcome;
  const errors = imp.results.filter((r) => !r.ok && !r.skipped);
  const skipped = imp.results.filter((r) => r.skipped);
  const withNotes = imp.results.filter((r) => r.ok && r.message);
  const photosAsked = imp.photos.length;
  return (
    <div className="space-y-3 text-sm" aria-live="polite">
      <p role="status" className="rounded-xl bg-leaf-soft px-3 py-2 text-forest-deep">
        ✓ {imp.created} prenda(s) creada(s)
        {imp.skippedExisting > 0 && ` · ${imp.skippedExisting} ya existían`}
        {match ? ` · ${outcome.uploaded} de ${photosAsked} foto(s) subida(s) y publicada(s)` : " · sin fotos: quedaron pendientes"}.
      </p>

      {outcome.quota.length > 0 && (
        <div className="rounded-xl bg-coral/10 px-3 py-2">
          <p className="font-medium text-coral">{outcome.quota.length} foto(s) rechazada(s) por la cuota de almacenamiento:</p>
          <p className="text-ink/70">{outcome.quota[0].message}</p>
          <ul className="mt-1 space-y-0.5 text-ink/80">{outcome.quota.map((q) => <li key={q.name}>{q.name}</li>)}</ul>
        </div>
      )}
      {outcome.failed.length > 0 && (
        <div className="rounded-xl bg-coral/10 px-3 py-2">
          <p className="font-medium text-coral">{outcome.failed.length} foto(s) no se pudieron subir:</p>
          <ul className="mt-1 space-y-0.5 text-ink/80">{outcome.failed.map((f) => <li key={f.name}>{f.name}: {f.message}</li>)}</ul>
        </div>
      )}
      {match && match.garmentsWithoutFile.length > 0 && (
        <details className="rounded-xl bg-white/40 px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-ink/70">Prendas sin su foto en la carpeta ({match.garmentsWithoutFile.length})</summary>
          <ul className="mt-2 space-y-1 text-ink/70">
            {match.garmentsWithoutFile.map((g) => (
              <li key={g.garmentId}>Fila {g.line} · {titleByLine.get(g.line) ?? "prenda"}: esperaba «{g.expectedFile}». Queda pendiente, súbele la foto abajo.</li>
            ))}
          </ul>
        </details>
      )}
      {match && match.filesWithoutGarment.length > 0 && (
        <details className="rounded-xl bg-white/40 px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-ink/70">Fotos sin prenda en el Excel ({match.filesWithoutGarment.length})</summary>
          <ul className="mt-2 space-y-1 text-ink/70">{match.filesWithoutGarment.map((f, i) => <li key={`${f.name}-${i}`}>{f.name}</li>)}</ul>
        </details>
      )}
      {match && match.ambiguous.length > 0 && (
        <p className="rounded-xl bg-coral/10 px-3 py-2 text-ink/80">
          Nombres repetidos en subcarpetas distintas (no se subió ninguno): {match.ambiguous.join(", ")}.
        </p>
      )}
      {match && match.ignored > 0 && <p className="text-ink/50">{match.ignored} archivo(s) que no son imágenes se ignoraron.</p>}

      {skipped.length > 0 && (
        <details className="rounded-xl bg-white/40 px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-ink/70">Filas que ya existían, no se duplicaron ({skipped.length})</summary>
          <ul className="mt-2 space-y-1 text-ink/70">{skipped.map((r) => <li key={r.line}>Fila {r.line} · {r.title}: {r.message}</li>)}</ul>
        </details>
      )}
      {withNotes.length > 0 && (
        <details className="rounded-xl bg-white/40 px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-ink/70">Avisos en filas creadas ({withNotes.length})</summary>
          <ul className="mt-2 space-y-1 text-ink/70">{withNotes.map((r) => <li key={r.line}>Fila {r.line} · {r.title}: {r.message}</li>)}</ul>
        </details>
      )}
      {errors.length > 0 && (
        <div className="rounded-xl bg-coral/10 px-3 py-2">
          <p className="font-medium text-coral">{errors.length} fila(s) no se importaron:</p>
          <ul className="mt-1 space-y-1 text-ink/80">{errors.map((r) => <li key={r.line}>Fila {r.line} · {r.title}: {r.message}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
