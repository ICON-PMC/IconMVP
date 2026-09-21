"use client";

import { useActionState } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importGarments, type ImportResult } from "./actions";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportResult, FormData>(importGarments, null);

  const errors = state?.results.filter((r) => !r.ok) ?? [];
  const oks = state?.results.filter((r) => r.ok) ?? [];

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

      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="file"
          name="file"
          aria-label="Plantilla completada (.xlsx)"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="sm:max-w-xs"
        />
        <Button type="submit" disabled={pending} className="rounded-full sm:px-6">
          {pending ? "Importando…" : "Importar prendas"}
        </Button>
      </form>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
          {state.error}
        </p>
      )}

      {state && !state.error && (
        <div className="space-y-3 text-sm">
          <p role="status" className="rounded-xl bg-leaf-soft px-3 py-2 text-forest-deep">
            ✓ {state.created} prenda(s) creada(s) en estado <b>pendiente</b>. Súbeles la foto
            abajo para publicarlas.
          </p>

          {oks.some((r) => r.message) && (
            <details className="rounded-xl bg-white/40 px-3 py-2">
              <summary className="min-h-11 cursor-pointer py-2 text-ink/70">
                Avisos en filas creadas ({oks.filter((r) => r.message).length})
              </summary>
              <ul className="mt-2 space-y-1 text-ink/70">
                {oks
                  .filter((r) => r.message)
                  .map((r) => (
                    <li key={r.line}>
                      Fila {r.line} · {r.title}: {r.message}
                    </li>
                  ))}
              </ul>
            </details>
          )}

          {errors.length > 0 && (
            <div className="rounded-xl bg-coral/10 px-3 py-2">
              <p className="font-medium text-coral">{errors.length} fila(s) no se importaron:</p>
              <ul className="mt-1 space-y-1 text-ink/80">
                {errors.map((r) => (
                  <li key={r.line}>
                    Fila {r.line} · {r.title}: {r.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
