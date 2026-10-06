// Normalización de links que escriben marcas y staff (tienda, producto, Instagram).
// Se usa al guardar y también al renderizar, para que los valores viejos mal guardados
// no produzcan links rotos (p. ej. "https://instagram.com/https://instagram.com/marca").

// Prefijos de esquema repetidos o mal escritos: "https://", "https://https://", "https//", "http:".
const SCHEME_PREFIX = /^(?:https?(?::\/*|\/+))+/i;

// Devuelve una URL absoluta válida (https por defecto) o null si no parece un sitio web.
// Acepta "tienda.com", "www.tienda.com/p", "https://tienda.com" y corrige "https://https://tienda.com".
export function normalizeUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/\s+/g, "");
  if (!v) return null;

  const prefix = v.match(SCHEME_PREFIX)?.[0] ?? "";
  const rest = v.slice(prefix.length);
  // Se respeta "http://" solo si es el único esquema escrito; en cualquier otro caso, https.
  const scheme = /^http:\/\/$/i.test(prefix) ? "http" : "https";

  try {
    const url = new URL(`${scheme}://${rest}`);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

// Extrae el usuario de Instagram de "@marca", "marca", "instagram.com/marca" o
// "https://www.instagram.com/marca/?hl=es". Devuelve null si no es un usuario válido.
export function normalizeInstagramHandle(raw: string | null | undefined): string | null {
  let v = (raw ?? "").trim();
  if (!v) return null;

  // El último "instagram.com/<usuario>" gana: cubre URLs duplicadas por un prefijo agregado dos veces.
  const fromUrl = [...v.matchAll(/instagram\.com\/([^/?#\s]+)/gi)].at(-1);
  if (fromUrl) v = fromUrl[1];
  v = v.replace(/^@+/, "").replace(/\/+$/, "");

  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}

export function instagramUrl(handle: string | null | undefined): string | null {
  const h = normalizeInstagramHandle(handle);
  return h ? `https://instagram.com/${h}` : null;
}
