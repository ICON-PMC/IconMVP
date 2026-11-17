import { StarRating } from "@/components/star-rating";
import { formatRating, showsAverage, type RatingSummary as Summary } from "@/lib/rating-rules";

/** Promedio, número y distribución (spec 011, FR-005). Con menos de 3 reseñas: "Aún pocas reseñas". */
export function RatingSummary({ summary }: { summary: Summary }) {
  if (!showsAverage(summary)) {
    return (
      <div className="surface p-5">
        <p className="text-h3 text-text">Aún pocas reseñas</p>
        <p className="mt-1 text-sm text-text-muted">
          {summary.count === 0 ? "Sé la primera persona en contar cómo te fue." : `${summary.count} ${summary.count === 1 ? "reseña" : "reseñas"} por ahora. Mostramos el promedio desde 3.`}
        </p>
      </div>
    );
  }
  const max = Math.max(1, ...summary.dist);
  return (
    <div className="surface flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
      <div className="flex flex-col items-start gap-1 sm:w-40">
        <p className="text-display leading-none text-text">{formatRating(summary.avg)}</p>
        <StarRating mode="display" value={summary.avg} size={20} />
        <p className="text-sm text-text-muted">
          {summary.count} {summary.count === 1 ? "reseña" : "reseñas"}
        </p>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5" aria-label="Reseñas por estrellas">
        {[5, 4, 3, 2, 1].map((s) => {
          const n = summary.dist[s - 1];
          return (
            <li key={s} className="flex items-center gap-2 text-[13px] text-text-muted">
              <span className="w-20 shrink-0 whitespace-nowrap">{s} {s === 1 ? "estrella" : "estrellas"}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                <span className="block h-full rounded-full bg-honey" style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="w-6 text-right tabular-nums">{n}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
