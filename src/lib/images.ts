// Resuelve la URL de una imagen.
// - Si el valor ya es una URL (http...), se usa tal cual (datos de muestra / transición).
// - Si es una clave de objeto de R2, se arma con la URL pública del bucket.
// La base se lee en cada llamada (no al cargar el módulo): los scripts (`npm run db:embed`)
// cargan .env.local después de importar este archivo. En Next, NEXT_PUBLIC_* sigue horneada.
export function imageUrl(
  idOrUrl: string | null | undefined,
): string | null {
  if (!idOrUrl) return null;
  if (/^https?:\/\//.test(idOrUrl)) return idOrUrl;
  const R2_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ?? "").replace(/\/$/, "");
  if (!R2_BASE) return null;
  return `${R2_BASE}/${idOrUrl.replace(/^\//, "")}`;
}

// ── Variantes (spec 006) ─────────────────────────────────────────────
// Cada foto en R2 existe en 1280 px (la clave principal) y en dos tamaños menores nombrados por
// convención: `a/b/x.webp` → `a/b/x.w320.webp` y `a/b/x.w640.webp`. La base solo guarda la principal.
export const IMAGE_VARIANT_WIDTHS = [320, 640] as const;
export const IMAGE_MAIN_WIDTH = 1280;
export type VariantWidth = (typeof IMAGE_VARIANT_WIDTHS)[number];

/** Clave de una variante, o null si el valor es una URL http o no es un .webp de R2. */
export function variantKey(key: string, width: VariantWidth): string | null {
  if (/^https?:\/\//.test(key) || !/\.webp$/.test(key) || /\.w\d+\.webp$/.test(key)) return null;
  return key.replace(/\.webp$/, `.w${width}.webp`);
}

/** `srcset` con las dos variantes y la principal; undefined si el valor no es una clave de R2. */
export function imageSrcSet(idOrUrl: string | null | undefined): string | undefined {
  if (!idOrUrl) return undefined;
  const main = imageUrl(idOrUrl);
  if (!main) return undefined;
  const parts: string[] = [];
  for (const w of IMAGE_VARIANT_WIDTHS) {
    const k = variantKey(idOrUrl, w);
    if (!k) return undefined;
    parts.push(`${imageUrl(k)} ${w}w`);
  }
  parts.push(`${main} ${IMAGE_MAIN_WIDTH}w`);
  return parts.join(", ");
}
