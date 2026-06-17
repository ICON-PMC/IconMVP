// Resuelve la URL de una imagen.
// - Si el valor ya es una URL (http...), se usa tal cual (datos de muestra / transición).
// - Si es una clave de objeto de R2, se arma con la URL pública del bucket.
const R2_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ?? "").replace(/\/$/, "");

export function imageUrl(
  idOrUrl: string | null | undefined,
): string | null {
  if (!idOrUrl) return null;
  if (/^https?:\/\//.test(idOrUrl)) return idOrUrl;
  if (!R2_BASE) return null;
  return `${R2_BASE}/${idOrUrl.replace(/^\//, "")}`;
}
