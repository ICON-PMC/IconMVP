/**
 * Convierte el catálogo de una tienda Shopify en un Excel listo para /admin/bulk
 * y una carpeta con la foto principal de cada prenda.
 *
 * Solo para marcas que dieron su consentimiento. Dos fuentes:
 *   --csv  products_export.csv   (preferida: el CSV que la marca exporta de su admin)
 *   --url  https://tienda.com    (lee /products.json, despacio y respetando robots.txt)
 *
 * Uso:
 *   npm run catalog:excel -- --marca "Under Gold" --url https://undergoldapparel.com --consentimiento
 *   npm run catalog:excel -- --marca "Under Gold" --csv ~/Downloads/products_export_1.csv \
 *        --url https://undergoldapparel.com --consentimiento
 *
 * Detalle completo: docs/importar-catalogo.md
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import ExcelJS from "exceljs";

// ───────────────────────────── argumentos ─────────────────────────────
const argv = process.argv.slice(2);
const has = (name: string) => argv.includes(`--${name}`);
function opt(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  const v = i >= 0 ? argv[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : undefined;
}

const AYUDA = `
Catálogo de una tienda Shopify → Excel para /admin/bulk + carpeta de fotos

  --marca "Nombre"      OBLIGATORIO. Nombre EXACTO de la marca en Icon (el importador la busca por nombre).
  --consentimiento      OBLIGATORIO. Confirma que la marca autorizó usar su catálogo.
  --csv  archivo.csv    CSV exportado del admin de Shopify (Productos → Exportar). Preferido.
  --url  https://...    Tienda. Sin --csv: se lee /products.json. Con --csv: solo arma las url_producto.
  --contacto correo     Tu correo; va en el User-Agent para que la tienda sepa quién eres.
  --pausa 2000          Milisegundos entre peticiones a la tienda (por defecto 2000).
  --max N               Solo los primeros N productos (útil para una primera prueba).
  --sin-fotos           No descarga fotos, solo genera el Excel.
  --salida carpeta      Dónde dejar todo (por defecto catalog-export).
`;

if (has("ayuda") || has("help")) {
  console.log(AYUDA);
  process.exit(0);
}

function die(msg: string, code = 1): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(code);
}

const MARCA = opt("marca");
const CSV_PATH = opt("csv");
const URL_ARG = opt("url");
const CONTACTO = opt("contacto");
const PAUSA = Math.max(0, Number(opt("pausa") ?? 2000) || 2000);
const MAX = Number(opt("max") ?? 0) || 0;
const SIN_FOTOS = has("sin-fotos");
const SALIDA = opt("salida") ?? "catalog-export";

if (!has("consentimiento"))
  die(
    "Este script solo debe usarse con marcas que te dieron permiso para usar su catálogo.\n" +
      "  Si lo tienes, agrega --consentimiento para confirmarlo. (Ver --ayuda)",
  );
if (!MARCA) die('Falta --marca "Nombre exacto de la marca en Icon". (Ver --ayuda)');
if (!CSV_PATH && !URL_ARG) die("Indica la fuente: --csv archivo.csv o --url https://tienda.com. (Ver --ayuda)");

let ORIGIN: string | null = null;
if (URL_ARG) {
  try {
    ORIGIN = new URL(URL_ARG).origin; // descarta rutas y parámetros de tracking (gclid, etc.)
  } catch {
    die(`La URL no es válida: ${URL_ARG}`);
  }
}

// ───────────────────────────── utilidades ─────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const slug = (s: string) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sin-nombre";

const UA = `IconCatalogBot/1.0 (+${CONTACTO ?? "equipo Icon"}; importación con consentimiento de la marca)`;

class BloqueadoError extends Error {}

// Petición educada: identificada, con espera y reintentos limitados si la tienda pide frenar.
// Si sigue pidiendo frenar, se detiene (nunca se intenta esquivar el límite).
async function politeFetch(url: string, tries = 4): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*" },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status !== 429 && res.status !== 503) return res;
    if (attempt >= tries) throw new BloqueadoError(`${res.status} en ${new URL(url).host}`);
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Math.min(retryAfter > 0 ? retryAfter * 1000 : 5000 * 2 ** attempt, 60_000);
    console.log(`  ⏳ La tienda pidió esperar (${res.status}). Reintento en ${Math.round(waitMs / 1000)} s…`);
    await sleep(waitMs);
  }
}

// ───────────────────────────── vocabulario de Icon (categorías, tallas, marcas) ─────────────────────────────
// Se lee de la base (tablas públicas: lo ve cualquiera con la anon key) para que el Excel use
// EXACTAMENTE los nombres que acepta el importador. Si no hay conexión, se usa la lista de
// supabase/seed.sql y se avisa.
type Vocabulary = {
  categories: string[];
  sizes: { label: string; aliases: string[] }[];
  brands: string[];
  source: string;
};

const FALLBACK_VOCABULARY: Vocabulary = {
  categories: [
    "Abrigos y tejidos", "Accesorios", "Blusas", "Bolsos", "Calzado", "Camisas", "Chaquetas",
    "Enterizos y conjuntos", "Faldas", "Jeans", "Pantalones", "Shorts", "Swimwear", "Tops", "Vestidos",
  ],
  sizes: [
    { label: "XXXS", aliases: ["3XS"] }, { label: "XXS", aliases: ["2XS"] }, { label: "XS", aliases: [] },
    { label: "S", aliases: [] }, { label: "M", aliases: [] }, { label: "L", aliases: [] }, { label: "XL", aliases: [] },
    { label: "XXL", aliases: ["2XL"] }, { label: "XXXL", aliases: ["3XL"] },
    { label: "Onesize", aliases: ["os", "unitalla", "talla unica"] }, { label: "Plussize", aliases: ["plus", "curvy"] },
  ],
  brands: [],
  source: "lista de respaldo (supabase/seed.sql), sin conexión a la base",
};

function loadEnvFile(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* sin .env.local */
  }
}

async function loadVocabulary(): Promise<Vocabulary> {
  loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return FALLBACK_VOCABULARY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as T;
  };
  try {
    const [cats, sizes, brands] = await Promise.all([
      get<{ name: string }[]>("tags?select=name&type=eq.category&order=name"),
      get<{ label: string; aliases: string[] | null }[]>("sizes?select=label,aliases&order=sort_order"),
      get<{ name: string }[]>("brands?select=name&order=name"),
    ]);
    if (!cats.length || !sizes.length) return FALLBACK_VOCABULARY;
    return {
      categories: cats.map((c) => c.name),
      sizes: sizes.map((s) => ({ label: s.label, aliases: s.aliases ?? [] })),
      brands: brands.map((b) => b.name),
      source: `la base de Icon (${new URL(url).host})`,
    };
  } catch {
    return FALLBACK_VOCABULARY;
  }
}

// ───────────────────────────── robots.txt ─────────────────────────────
type RobotsGroup = { agents: string[]; rules: { allow: boolean; pattern: string }[] };

function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let cur: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && cur) {
      lastWasAgent = false;
      if (val) cur.rules.push({ allow: key === "allow", pattern: val });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function robotsAllows(groups: RobotsGroup[], path: string): boolean {
  const group =
    groups.find((g) => g.agents.includes("iconcatalogbot")) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  let best: { allow: boolean; len: number } | null = null;
  for (const r of group.rules) {
    const re = new RegExp(
      "^" + r.pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"),
    );
    if (re.test(path) && (!best || r.pattern.length > best.len || (r.pattern.length === best.len && r.allow)))
      best = { allow: r.allow, len: r.pattern.length };
  }
  return best ? best.allow : true;
}

// ───────────────────────────── modelo ─────────────────────────────
type Product = {
  handle: string;
  title: string;
  descriptionHtml: string;
  productType: string;
  tags: string[];
  price: number | null;
  colors: string[];
  sizes: string[];
  imageUrl: string | null;
};

const uniq = <T>(a: T[]) => [...new Set(a)];
const parsePrice = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Una opción se llama "Talla"/"Size" o "Color"/"Colour" según la tienda.
const isSizeOption = (name: string) => /talla|size|tamano/.test(norm(name));
const isColorOption = (name: string) => /color|colour/.test(norm(name));

// ───────────────────────────── fuente: tienda en vivo ─────────────────────────────
type ShopifyJson = {
  title: string;
  handle: string;
  body_html?: string | null;
  product_type?: string;
  tags?: string[] | string;
  variants?: { price?: string }[];
  options?: { name: string; values: string[] }[];
  images?: { src: string; position?: number }[];
};

function fromShopifyJson(p: ShopifyJson): Product {
  const prices = (p.variants ?? []).map((v) => parsePrice(v.price)).filter((n): n is number => n != null);
  const opts = p.options ?? [];
  const images = [...(p.images ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return {
    handle: p.handle,
    title: (p.title ?? "").trim(),
    descriptionHtml: p.body_html ?? "",
    productType: p.product_type ?? "",
    tags: Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(","),
    price: prices.length ? Math.min(...prices) : null,
    colors: uniq(opts.filter((o) => isColorOption(o.name)).flatMap((o) => o.values)),
    sizes: uniq(opts.filter((o) => isSizeOption(o.name)).flatMap((o) => o.values)),
    imageUrl: images[0]?.src ?? null,
  };
}

async function fetchLive(origin: string): Promise<{ products: Product[]; currency?: string; source: string }> {
  try {
    const robots = await politeFetch(`${origin}/robots.txt`);
    if (robots.ok && !robotsAllows(parseRobots(await robots.text()), "/products.json"))
      die("El robots.txt de la tienda NO permite leer /products.json. Pídele a la marca el CSV (--csv).");
  } catch (e) {
    if (e instanceof BloqueadoError) throw e;
    console.log("  (no se pudo leer robots.txt; se continúa con cuidado)");
  }

  let currency: string | undefined;
  try {
    await sleep(PAUSA);
    const meta = await politeFetch(`${origin}/meta.json`);
    if (meta.ok) currency = ((await meta.json()) as { currency?: string }).currency;
  } catch (e) {
    if (e instanceof BloqueadoError) throw e;
  }

  const products: Product[] = [];
  const seen = new Set<string>();
  for (let page = 1; ; page++) {
    await sleep(PAUSA);
    const res = await politeFetch(`${origin}/products.json?limit=250&page=${page}`);
    if (!res.ok) die(`La tienda respondió ${res.status} en /products.json. ¿Es una tienda Shopify? Prueba con --csv.`);
    let body: { products?: ShopifyJson[] };
    try {
      body = (await res.json()) as { products?: ShopifyJson[] };
    } catch {
      die("La respuesta no es JSON. ¿Es una tienda Shopify? Prueba con --csv.");
    }
    const batch = body.products ?? [];
    for (const p of batch) {
      if (!seen.has(p.handle)) {
        seen.add(p.handle);
        products.push(fromShopifyJson(p));
      }
    }
    console.log(`  Página ${page}: ${batch.length} productos (${products.length} en total)`);
    if (batch.length < 250 || (MAX && products.length >= MAX)) break;
  }
  return { products, currency, source: `${origin}/products.json` };
}

// ───────────────────────────── fuente: CSV de Shopify ─────────────────────────────
// Parser CSV mínimo (comillas, comillas escapadas, saltos de línea dentro de celdas, BOM).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

function fromCsv(path: string): Product[] {
  const rows = parseCsv(readFileSync(path, "utf8"));
  if (rows.length < 2) die("El CSV está vacío.");
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const col = {
    handle: idx("Handle"),
    title: idx("Title"),
    body: idx("Body (HTML)"),
    type: idx("Type"),
    category: idx("Product Category"),
    tags: idx("Tags"),
    status: idx("Status"),
    price: idx("Variant Price"),
    imgSrc: idx("Image Src"),
    imgPos: idx("Image Position"),
  };
  if (col.handle < 0 || col.title < 0)
    die("No parece un CSV de productos de Shopify (faltan las columnas Handle y Title).");
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const byHandle = new Map<string, string[][]>();
  for (const r of rows.slice(1)) {
    const h = get(r, col.handle);
    if (!h) continue;
    if (!byHandle.has(h)) byHandle.set(h, []);
    byHandle.get(h)!.push(r);
  }

  const products: Product[] = [];
  for (const [handle, group] of byHandle) {
    const first = group.find((r) => get(r, col.title)) ?? group[0];
    if (col.status >= 0 && get(first, col.status).toLowerCase() !== "active") continue;

    const optNames = [1, 2, 3].map((n) => get(first, idx(`Option${n} Name`)));
    const optValues = [1, 2, 3].map((n) => uniq(group.map((r) => get(r, idx(`Option${n} Value`))).filter(Boolean)));
    const prices = group.map((r) => parsePrice(get(r, col.price))).filter((n): n is number => n != null);
    const imgs = group
      .map((r) => ({ src: get(r, col.imgSrc), pos: Number(get(r, col.imgPos)) || 999 }))
      .filter((i) => i.src)
      .sort((a, b) => a.pos - b.pos);

    products.push({
      handle,
      title: get(first, col.title),
      descriptionHtml: get(first, col.body),
      productType: `${get(first, col.type)} ${get(first, col.category)}`.trim(),
      tags: get(first, col.tags).split(","),
      price: prices.length ? Math.min(...prices) : null,
      colors: uniq(optNames.flatMap((n, k) => (n && isColorOption(n) ? optValues[k] : []))),
      sizes: uniq(optNames.flatMap((n, k) => (n && isSizeOption(n) ? optValues[k] : []))),
      imageUrl: imgs[0]?.src ?? null,
    });
  }
  return products;
}

// ───────────────────────────── normalización a los datos de Icon ─────────────────────────────
function htmlToText(html: string): string {
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

// Devuelve el nombre tal como está en la base, o "" si no hay certeza o esa categoría no existe allí.
function inferCategory(p: Product, vocab: Vocabulary): string {
  const known = new Map(vocab.categories.map((c) => [norm(c), c]));
  for (const source of [p.productType, p.title, p.tags.join(" ")]) {
    const text = norm(source);
    if (!text) continue;
    for (const [name, re] of CATEGORY_RULES) if (re.test(text)) return known.get(norm(name)) ?? "";
  }
  return "";
}

// Tallas: se traducen a la etiqueta EXACTA de la base. Las que no existan en Icon salen en `unknown`.
const SIZE_SYNONYMS = /^(unica|unico|u|one ?size|talla unica|unitalla)$/;

function normalizeSizes(raw: string[], vocab: Vocabulary): { sizes: string[]; unknown: string[] } {
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

// Shopify sirve el original; pedimos 2000 px de ancho para que cada foto quede bajo el tope de 10 MB.
function imageDownloadUrl(src: string): string {
  const u = new URL(src.startsWith("//") ? `https:${src}` : src);
  if (u.hostname.endsWith("cdn.shopify.com")) u.searchParams.set("width", "2000");
  return u.toString();
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

async function downloadPhoto(src: string, destBase: string): Promise<{ file: string; bytes: number; buf: Buffer }> {
  const url = imageDownloadUrl(src);
  let res = await politeFetch(url);
  if (!res.ok && url !== src) res = await politeFetch(new URL(src.startsWith("//") ? `https:${src}` : src).toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = EXT_BY_TYPE[type] ?? (new URL(url).pathname.match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1].toLowerCase() ?? "jpg");
  const buf = Buffer.from(await res.arrayBuffer());
  const file = `${destBase}.${ext === "jpeg" ? "jpg" : ext}`;
  return { file, bytes: buf.length, buf };
}

// ───────────────────────────── principal ─────────────────────────────
async function main() {
  console.log(`\nCatálogo de «${MARCA}»\n`);

  const vocab = await loadVocabulary();
  console.log(`Categorías y tallas válidas leídas de: ${vocab.source}`);
  if (vocab === FALLBACK_VOCABULARY)
    console.log("  ⚠ Sin conexión a la base: las tallas numéricas (4, 6, 14…) y otras recientes no se reconocerán.");
  else if (vocab.brands.length && !vocab.brands.some((b) => norm(b) === norm(MARCA!)))
    console.log(
      `  ⚠ «${MARCA}» no aparece entre las marcas activas de Icon. Si ya la creaste puede estar inactiva;\n` +
        "    si no, créala antes de importar (el importador la busca por nombre).",
    );
  console.log("");

  let products: Product[];
  let source: string;
  let currency: string | undefined;

  if (CSV_PATH) {
    console.log(`Leyendo CSV: ${CSV_PATH}`);
    products = fromCsv(CSV_PATH);
    source = `csv:${basename(CSV_PATH)}`;
    if (!ORIGIN) console.log("  ⚠ Sin --url: la columna url_producto quedará vacía.");
  } else {
    console.log(`Leyendo ${ORIGIN} (con pausas de ${PAUSA / 1000} s)…`);
    ({ products, currency, source } = await fetchLive(ORIGIN!));
  }
  if (MAX) products = products.slice(0, MAX);
  if (!products.length) die("No se encontraron productos.");

  const outDir = join(SALIDA, slug(MARCA!));
  const photosDir = join(outDir, "fotos");
  mkdirSync(photosDir, { recursive: true });

  const columns = [
    { header: "marca", key: "marca", width: 26 },
    { header: "titulo", key: "titulo", width: 34 },
    { header: "descripcion", key: "descripcion", width: 50 },
    { header: "precio_cop", key: "precio_cop", width: 14 },
    { header: "url_producto", key: "url_producto", width: 40 },
    { header: "color", key: "color", width: 18 },
    { header: "tela", key: "tela", width: 18 },
    { header: "categoria", key: "categoria", width: 22 },
    { header: "tallas", key: "tallas", width: 22 },
    // Las dos últimas las ignora el importador; son para ti.
    { header: "foto", key: "foto", width: 40 },
    { header: "revisar", key: "revisar", width: 60 },
  ];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Prendas");
  ws.columns = columns;
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const stats = { sinCategoria: 0, sinTalla: 0, sinPrecio: 0, sinFoto: 0, fotos: 0 };
  let fotosBloqueadas = false;
  const tallasDesconocidas = new Map<string, number>();

  for (const [i, p] of products.entries()) {
    const notes: string[] = [];
    const categoria = inferCategory(p, vocab);
    if (!categoria) {
      stats.sinCategoria++;
      notes.push("asignar categoría");
    }
    const { sizes, unknown } = normalizeSizes(p.sizes, vocab);
    for (const u of unknown) tallasDesconocidas.set(u, (tallasDesconocidas.get(u) ?? 0) + 1);
    if (!sizes.length) {
      stats.sinTalla++;
      notes.push("sin talla");
    }
    if (unknown.length) notes.push(`talla que no existe en Icon (se omite al importar): ${unknown.join(", ")}`);
    if (p.price == null) {
      stats.sinPrecio++;
      notes.push("sin precio");
    }
    if (currency && currency !== "COP") notes.push(`precio en ${currency}, no COP`);

    let foto = "";
    if (!p.imageUrl) {
      stats.sinFoto++;
      notes.push("la tienda no trae foto");
    } else if (!SIN_FOTOS && !fotosBloqueadas) {
      try {
        const base = `${String(i + 1).padStart(3, "0")}-${slug(p.title).slice(0, 50)}`;
        const { file, bytes, buf } = await downloadPhoto(p.imageUrl, base);
        writeFileSync(join(photosDir, file), buf);
        foto = file;
        stats.fotos++;
        if (bytes > 9.5 * 1024 * 1024) notes.push("foto > 10 MB: el panel la rechazará, reduce su tamaño");
        process.stdout.write(`\r  Fotos: ${stats.fotos}/${products.length}   `);
        await sleep(300);
      } catch (e) {
        if (e instanceof BloqueadoError) {
          fotosBloqueadas = true;
          console.log("\n  ⚠ El servidor de imágenes pidió frenar; se omiten las fotos restantes.");
        }
        stats.sinFoto++;
        notes.push("foto no descargada");
      }
    } else if (!SIN_FOTOS) {
      stats.sinFoto++;
      notes.push("foto no descargada");
    }

    ws.addRow({
      marca: MARCA,
      titulo: p.title,
      descripcion: htmlToText(p.descriptionHtml),
      // Entero a propósito: el importador borra todo lo que no sea dígito, así que "189000.00" se leería como 18900000.
      precio_cop: p.price != null ? Math.round(p.price) : "",
      url_producto: ORIGIN ? `${ORIGIN}/products/${p.handle}` : "",
      color: p.colors.join(", "),
      tela: "",
      categoria,
      tallas: sizes.join(", "),
      foto,
      revisar: notes.join("; "),
    });
  }
  if (!SIN_FOTOS) process.stdout.write("\n");

  // Hoja de referencia con los valores EXACTOS de la base (misma forma que la plantilla de /admin/bulk)
  // y desplegables en marca y categoría, para no tener que adivinar cómo se escribe cada nombre.
  const refName = "Referencia (no editar)";
  const ref = wb.addWorksheet(refName);
  ref.columns = [
    { header: "Marcas", key: "marcas", width: 28 },
    { header: "Categorías", key: "categorias", width: 24 },
    { header: "Tallas", key: "tallas", width: 14 },
  ];
  ref.getRow(1).font = { bold: true };
  const brandList = vocab.brands.length ? vocab.brands : [MARCA!];
  const sizeList = vocab.sizes.map((x) => x.label);
  for (let r = 0; r < Math.max(brandList.length, vocab.categories.length, sizeList.length); r++)
    ref.addRow([brandList[r] ?? null, vocab.categories[r] ?? null, sizeList[r] ?? null]);

  const q = `'${refName}'`;
  const lastRow = Math.max(501, products.length + 1 + 200);
  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(`A${r}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`${q}!$A$2:$A$${brandList.length + 1}`],
      showErrorMessage: true,
      errorTitle: "Marca no válida",
      error: "Elige la marca de la lista (hoja Referencia).",
    };
    ws.getCell(`H${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`${q}!$B$2:$B$${vocab.categories.length + 1}`],
      showErrorMessage: true,
      errorTitle: "Categoría no válida",
      error: "Elige una categoría de la lista (hoja Referencia).",
    };
  }
  ws.getCell("H1").note = "Elige de la lista desplegable. Son las categorías que existen en Icon.";
  ws.getCell("I1").note =
    "Varias tallas separadas por coma, por ejemplo: S, M, L. Excel no permite elegir varias de una lista: " +
    "los valores válidos están en la hoja «Referencia (no editar)». Una talla que no esté ahí se omite al importar.";
  ws.getCell("J1").note = "Solo para ti: nombre del archivo en la carpeta fotos/. El importador la ignora.";
  ws.getCell("K1").note = "Solo para ti: cosas por revisar en esa fila. El importador la ignora.";

  const xlsxPath = join(outDir, "catalogo.xlsx");
  await wb.xlsx.writeFile(xlsxPath);

  writeFileSync(
    join(outDir, "origen.json"),
    JSON.stringify(
      {
        marca: MARCA,
        fuente: source,
        fecha: new Date().toISOString(),
        consentimiento_confirmado_por_quien_ejecuto: true,
        contacto: CONTACTO ?? null,
        moneda_reportada_por_la_tienda: currency ?? "desconocida",
        productos: products.length,
        fotos_descargadas: stats.fotos,
      },
      null,
      2,
    ),
  );

  console.log(`\n✓ ${products.length} productos`);
  console.log(`  Excel:  ${xlsxPath}`);
  if (!SIN_FOTOS) console.log(`  Fotos:  ${photosDir}  (${stats.fotos} descargadas)`);
  console.log(`  A revisar: ${stats.sinCategoria} sin categoría · ${stats.sinTalla} sin talla · ${stats.sinPrecio} sin precio · ${stats.sinFoto} sin foto`);
  if (tallasDesconocidas.size) {
    const lista = [...tallasDesconocidas].map(([t, c]) => `${t} (${c})`).join(", ");
    console.log(`\n  ⚠ Tallas que NO existen en Icon y se omitirían al importar: ${lista}`);
    console.log("    Agrégalas a la base antes de importar (ver docs/importar-catalogo.md → «Tallas numéricas»).");
  }
  if (currency && currency !== "COP")
    console.log(`\n  ⚠ La tienda reporta precios en ${currency}, no en COP. Corrige precio_cop antes de importar.`);
  else if (!currency)
    console.log("\n  ⚠ Confirma que los precios estén en COP: se copian tal cual vienen de la tienda.");
  console.log("\nSiguiente paso: abre el Excel, revisa la columna «revisar» y sube el archivo en /admin/bulk.\n");
}

main().catch((e) => {
  if (e instanceof BloqueadoError)
    die(
      `La tienda está limitando las peticiones (${e.message}) y no se pudo continuar.\n` +
        "  No insistas ni busques cómo esquivarlo: pídele a la marca el CSV de productos\n" +
        "  (admin de Shopify → Productos → Exportar) y usa --csv. Ver docs/importar-catalogo.md",
      2,
    );
  die(e instanceof Error ? e.message : String(e));
});
