"use client";

import { useActionState } from "react";
import { importGarments, type ImportResult } from "./actions";

const submit =
  "rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-forest-deep disabled:opacity-50";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportResult, FormData>(
    importGarments,
    null,
  );

  const errors = state?.results.filter((r) => !r.ok) ?? [];
  const oks = state?.results.filter((r) => r.ok) ?? [];

  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="glass-input rounded-lg px-3 py-2 text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-3 file:py-1 file:text-xs file:text-white"
        />
        <button className={submit} type="submit" disabled={pending}>
          {pending ? "Importando…" : "Importar prendas"}
        </button>
      </form>

      {state?.error && (
        <p className="mt-3 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
          {state.error}
        </p>
      )}

      {state && !state.error && (
        <div className="mt-4 space-y-3 text-sm">
          <p className="rounded-xl bg-leaf-soft px-3 py-2 text-forest-deep">
            ✓ {state.created} prenda(s) creada(s) en estado <b>pendiente</b>. Súbeles la
            foto abajo para publicarlas.
          </p>

          {oks.some((r) => r.message) && (
            <details className="rounded-xl bg-white/40 px-3 py-2">
              <summary className="cursor-pointer text-ink/70">
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
              <p className="font-medium text-coral">
                {errors.length} fila(s) no se importaron:
              </p>
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
