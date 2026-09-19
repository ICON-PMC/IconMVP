// Validación y normalización compartidas del registro de marca (server actions + formularios).

export const BRAND_NAME_MAX = 80;
export const BRAND_BIO_MAX = 280;

export type BrandProfileInput = {
  name: string;
  bio: string;
  city: string;
  link: string;
};

export type FieldErrors = Partial<Record<keyof BrandProfileInput | "cover", string>>;

export function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "marca"
  );
}

// Acepta un sitio web (con o sin https://) o un WhatsApp (número colombiano de 10 dígitos o
// internacional) y devuelve una URL; o null si no parece ninguna de las dos.
export function normalizeBrandLink(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;

  const digits = v.replace(/[\s()-]/g, "");
  if (/^\+?\d{7,15}$/.test(digits)) {
    const n = digits.replace(/^\+/, "");
    return `https://wa.me/${n.length === 10 && n.startsWith("3") ? "57" + n : n}`;
  }

  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

export function validateBrandProfile(input: BrandProfileInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.name) errors.name = "Escribe el nombre de tu marca.";
  else if (input.name.length > BRAND_NAME_MAX)
    errors.name = `Máximo ${BRAND_NAME_MAX} caracteres.`;

  if (!input.bio) errors.bio = "Cuéntanos brevemente de tu marca.";
  else if (input.bio.length > BRAND_BIO_MAX)
    errors.bio = `Máximo ${BRAND_BIO_MAX} caracteres (tienes ${input.bio.length}).`;

  if (!input.city) errors.city = "Elige la ciudad de tu marca.";

  if (!input.link) errors.link = "Agrega tu sitio web o WhatsApp.";
  else if (!normalizeBrandLink(input.link))
    errors.link = "Ingresa un sitio web válido o un número de WhatsApp.";

  return errors;
}
