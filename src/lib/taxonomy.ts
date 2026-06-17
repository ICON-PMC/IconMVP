// Rangos de precio (COP) para el filtro del feed. Coinciden con el enum price_range de la BD.
export const PRICE_BUCKETS = [
  { value: "under_100k", label: "< $100k" },
  { value: "100k_200k", label: "$100–200k" },
  { value: "200k_350k", label: "$200–350k" },
  { value: "350k_500k", label: "$350–500k" },
  { value: "over_500k", label: "> $500k" },
] as const;

export function formatCop(n: number): string {
  return "$" + Math.round(n / 1000) + "k";
}

export function priceLabel(min: number | null, max: number | null): string | null {
  if (min == null) return null;
  if (max == null || max === min) return formatCop(min);
  return `${formatCop(min)}–${formatCop(max)}`;
}
