// Reglas puras de reseñas (spec 011). Importable desde el cliente.

export const RATING_MIN_FOR_AVG = 3;
export const RATING_BODY = { min: 20, max: 1000 } as const;
export const RATINGS_PAGE = 10;

export type RatingSummary = { avg: number | null; count: number; dist: [number, number, number, number, number] };

/** "4,6" */
export function formatRating(avg: number): string {
  return avg.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function summaryFrom(b: { rating_avg: number | null; rating_count: number; rating_dist: number[] | null }): RatingSummary {
  const d = b.rating_dist ?? [];
  return {
    avg: b.rating_avg == null ? null : Number(b.rating_avg),
    count: b.rating_count ?? 0,
    dist: [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, d[3] ?? 0, d[4] ?? 0],
  };
}

/** Se muestra el promedio solo con suficientes reseñas. */
export function showsAverage(s: Pick<RatingSummary, "avg" | "count">): s is { avg: number; count: number } {
  return s.avg != null && s.count >= RATING_MIN_FOR_AVG;
}
