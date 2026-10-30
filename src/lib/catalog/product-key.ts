// Clave estable de una prenda dentro de una marca, a partir de su enlace de compra. La usan la
// deduplicación al importar (FR-014) y la comparación con la tienda (FR-021).
// Módulo sin dependencias de Next.

// "https://www.Tienda.com/products/Vestido-Lino?variant=1" → "vestido-lino".
// Si la URL no contiene /products/, se usa host + ruta (sin barra final ni query).
// Devuelve null si la URL está vacía o no es válida.
export function productKey(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  let u: URL;
  try {
    // Una ruta sin dominio ("/products/vestido") se resuelve contra un host de relleno: si se anteponía
    // https:// la URL la tomaba como host y la clave salía mal.
    u = raw.startsWith("/") ? new URL(raw, "https://sin-dominio.invalid") : new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const m = u.pathname.match(/\/products\/([^/?#]+)/i);
  if (m) {
    let handle = m[1];
    try {
      handle = decodeURIComponent(handle);
    } catch {
      /* se deja tal cual */
    }
    return handle.toLowerCase();
  }
  const path = u.pathname.replace(/\/+$/, "");
  return `${u.hostname.replace(/^www\./i, "").toLowerCase()}${path.toLowerCase()}` || null;
}
