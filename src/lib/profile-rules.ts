// Reglas puras del perfil (spec 009). Importable desde el cliente; profile.ts NO (usa el servidor).

export const PROFILE_LIMITS = { displayName: 40, bio: 160, handleMin: 3, handleMax: 24 } as const;

/** Normaliza lo que se escribe en el campo de nombre de usuario: minúsculas, sin espacios ni @. */
export function normalizeHandleInput(v: string): string {
  return v.toLowerCase().replace(/^@+/, "").replace(/\s+/g, "").slice(0, PROFILE_LIMITS.handleMax);
}

/** Dominio visible de un enlace ("https://www.tienda.com/x" → "tienda.com"). */
export function linkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const COVERS = ["bg-leaf", "bg-honey", "bg-sky", "bg-blush"] as const;
/** Color de portada estable por id. */
export function coverClass(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COVERS[Math.abs(h) % COVERS.length];
}
