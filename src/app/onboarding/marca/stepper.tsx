import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Indicador de pasos: "Paso n de N" + barra de progreso + etiquetas. Los pasos ya completados
 * son enlaces para volver a editarlos (solo cuando la marca ya existe: `canGoBack`).
 */
export function Stepper({
  steps,
  current,
  canGoBack,
}: {
  steps: string[];
  current: number;
  canGoBack: boolean;
}) {
  return (
    <div className="mb-6">
      <p className="text-xs text-ink/60">
        Paso {current} de {steps.length}
      </p>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current}
        aria-label="Progreso del registro"
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className="h-full rounded-full bg-forest transition-all"
          style={{ width: `${(current / steps.length) * 100}%` }}
        />
      </div>
      <ol className="mt-3 flex items-center justify-between gap-1 text-xs">
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          const inner = (
            <>
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-[11px]",
                  done || active ? "bg-forest text-white" : "bg-ink/10 text-ink/50",
                )}
              >
                {done ? <CheckIcon className="size-3.5" aria-hidden /> : n}
              </span>
              <span className={cn(active ? "font-medium text-forest" : "text-ink/60")}>{label}</span>
            </>
          );
          return (
            <li key={label} aria-current={active ? "step" : undefined} className="flex-1">
              {done && canGoBack ? (
                <Link
                  href={`/onboarding/marca?paso=${n}`}
                  className="flex min-h-11 items-center gap-1.5 rounded-full hover:underline"
                >
                  {inner}
                  <span className="sr-only"> (completado, volver a editar)</span>
                </Link>
              ) : (
                <span className="flex min-h-11 items-center gap-1.5">{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
