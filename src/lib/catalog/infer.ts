// Normalización y sugerencias automáticas a partir de los datos de la tienda (categoría, estilo,
// ocasión, clima, tallas). Son SUGERENCIAS: el staff las revisa en el Excel antes de importar.
// Módulo sin dependencias de Next.
import type { Product } from "./shopify";
import type { TagOption, Vocabulary } from "./vocabulary";

// Máximo de etiquetas por tipo (estilo/ocasión/clima) que acepta el importador: src/lib/tags.ts
export const MAX_TAGS_PER_TYPE = 3;

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export const slug = (s: string) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sin-nombre";

export function htmlToText(html: string): string {
  const text = html
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|div|h\d)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 700 ? text.slice(0, 700).replace(/\s+\S*$/, "") + "…" : text;
}

// Categorías EXACTAS de Icon (supabase/seed.sql). El orden importa: gana la primera que coincide.
const CATEGORY_RULES: [string, RegExp][] = [
  ["Swimwear", /\b(bikini|trikini|swim|banador|traje de bano|vestido de bano|beachwear|pareo|salida de bano)/],
  ["Enterizos y conjuntos", /\b(enterizo|jumpsuit|romper|overol|conjunto|co-?ord)/],
  ["Vestidos", /\b(vestido|dress)/],
  ["Jeans", /\b(jean|denim)/],
  ["Pantalones", /\b(pantalon|pants|trouser|jogger|legging|palazzo|sudadera)/],
  ["Shorts", /\b(short|bermuda)/],
  ["Faldas", /\b(falda|skirt)/],
  ["Blusas", /\b(blusa|blouse)/],
  ["Tops", /\b(camiseta|t-?shirt|tee|tops?|crop|bodysuit|body|esqueleto|tank|camisilla|bralette|corset)\b/],
  ["Camisas", /\b(camisa|shirt|guayabera|polo)/],
  ["Chaquetas", /\b(chaqueta|jacket|blazer|bomber|chamarra|trench|gabardina|cazadora)/],
  ["Abrigos y tejidos", /\b(abrigo|coat|sueter|sweater|cardigan|tejido|knit|buzo|hoodie|poncho|ruana|chal|chaleco|pullover)/],
  ["Calzado", /\b(zapato|sandalia|tacon|bota|tenis|zapatilla|shoe|sandal|boot|sneaker|mocasin|alpargata|calzado)/],
  ["Bolsos", /\b(bolso|cartera|bag|tote|mochila|clutch|rinonera|morral|billetera|handbag)/],
  ["Accesorios", /\b(collar|arete|pulsera|anillo|gafa|lente|sombrero|gorra|cinturon|bufanda|panuelo|accesorio|jewel|earring|necklace|bracelet|\bhat|belt|scarf)/],
];

// Estilo / ocasión / clima: se prellenan SOLO cuando un tag de la tienda coincide exactamente (sin acentos
// ni mayúsculas) con el nombre o slug de la base. No se infiere del título ni de la descripción: sería
// adivinar. Lo demás queda vacío para que lo elijas tú. Respeta el tope del importador (3 por tipo).
export function matchTags(p: Product, options: TagOption[]): { names: string[]; overflow: number } {
  const byKey = new Map<string, string>();
  for (const o of options) {
    byKey.set(norm(o.name), o.name);
    byKey.set(norm(o.slug), o.name);
  }
  const found: string[] = [];
  for (const t of [...p.tags, p.product_type]) {
    const name = byKey.get(norm(t));
    if (name && !found.includes(name)) found.push(name);
  }
  return { names: found.slice(0, MAX_TAGS_PER_TYPE), overflow: Math.max(0, found.length - MAX_TAGS_PER_TYPE) };
}

// Devuelve el nombre tal como está en la base, o "" si no hay certeza o esa categoría no existe allí.
export function inferCategory(p: Product, vocab: Vocabulary): string {
  const known = new Map(vocab.categories.map((c) => [norm(c), c]));
  for (const source of [p.product_type, p.title, p.tags.join(" ")]) {
    const text = norm(source);
    if (!text) continue;
    for (const [name, re] of CATEGORY_RULES) if (re.test(text)) return known.get(norm(name)) ?? "";
  }
  return "";
}

// Tallas: se traducen a la etiqueta EXACTA de la base. Las que no existan en Icon salen en `unknown`.
const SIZE_SYNONYMS = /^(unica|unico|u|one ?size|talla unica|unitalla)$/;

export function normalizeSizes(raw: string[], vocab: Vocabulary): { sizes: string[]; unknown: string[] } {
  const lookup = new Map<string, string>();
  for (const sz of vocab.sizes) {
    lookup.set(norm(sz.label), sz.label);
    for (const a of sz.aliases) lookup.set(norm(a), sz.label);
  }
  const sizes: string[] = [];
  const unknown: string[] = [];
  for (const piece of raw.flatMap((r) => r.split(/[/,;]/))) {
    let t = norm(piece).replace(/\s+/g, " ");
    if (!t) continue;
    if (SIZE_SYNONYMS.test(t)) t = "onesize";
    else if (/^plus ?size$/.test(t)) t = "plussize";
    const label = lookup.get(t);
    if (label) {
      if (!sizes.includes(label)) sizes.push(label);
    } else unknown.push(piece.trim());
  }
  return { sizes, unknown };
}
