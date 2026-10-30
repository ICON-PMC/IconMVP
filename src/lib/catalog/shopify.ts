// Lectura del catálogo de una tienda Shopify: en vivo (/products.json) o desde el CSV que exporta la marca.
// Compartido por el CLI y el panel. Módulo sin dependencias de Next.
import { norm } from "./infer";
import { BloqueadoError, politeFetch, parseRobots, robotsAllows, type FetchCtx } from "./http";

export type PhotoState = {
  // Nombre del archivo en el paquete (columna `foto` del Excel).
  file: string | null;
  bytes: number;
  // ok = descargada · missing = la tienda no trae foto · failed = no se pudo · blocked = la CDN pidió frenar
  // skipped = el staff pidió no descargar fotos · pending = aún no se intenta
  status: "ok" | "missing" | "failed" | "blocked" | "skipped" | "pending";
};

export type Product = {
  handle: string;
  title: string;
  description_html: string;
  product_type: string;
  tags: string[];
  price: number | null;
  colors: string[];
  sizes: string[];
  image_url: string | null;
  photo?: PhotoState;
  // Avisos de la foto (descarga fallida, > 10 MB…). Los de datos los agrega buildWorkbook.
  notes?: string[];
};

// Error de formato de la fuente. `code` deja que cada capa (CLI o panel) redacte su propia ayuda.
export class CatalogSourceError extends Error {
  constructor(
    public code: "not_shopify" | "bad_json" | "csv_empty" | "csv_not_shopify",
    message: string,
  ) {
    super(message);
  }
}

export const uniq = <T>(a: T[]) => [...new Set(a)];
export const parsePrice = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Una opción se llama "Talla"/"Size" o "Color"/"Colour" según la tienda.
const isSizeOption = (name: string) => /talla|size|tamano/.test(norm(name));
const isColorOption = (name: string) => /color|colour/.test(norm(name));

// ───────────────────────────── tienda en vivo ─────────────────────────────
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

export function fromShopifyJson(p: ShopifyJson): Product {
  const prices = (p.variants ?? []).map((v) => parsePrice(v.price)).filter((n): n is number => n != null);
  const opts = p.options ?? [];
  const images = [...(p.images ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return {
    handle: p.handle,
    title: (p.title ?? "").trim(),
    description_html: p.body_html ?? "",
    product_type: p.product_type ?? "",
    tags: Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(","),
    price: prices.length ? Math.min(...prices) : null,
    colors: uniq(opts.filter((o) => isColorOption(o.name)).flatMap((o) => o.values)),
    sizes: uniq(opts.filter((o) => isSizeOption(o.name)).flatMap((o) => o.values)),
    image_url: images[0]?.src ?? null,
  };
}

// 'allowed' | 'disallowed' (robots.txt no permite /products.json) | 'unknown' (no se pudo leer).
// Relanza BloqueadoError si la tienda pide frenar incluso para robots.txt.
export async function checkRobots(origin: string, ctx: FetchCtx): Promise<"allowed" | "disallowed" | "unknown"> {
  try {
    const robots = await politeFetch(`${origin}/robots.txt`, ctx);
    if (robots.ok) return robotsAllows(parseRobots(await robots.text()), "/products.json") ? "allowed" : "disallowed";
    return "allowed";
  } catch (e) {
    if (e instanceof BloqueadoError) throw e;
    return "unknown";
  }
}

// Moneda que reporta la tienda (/meta.json), o undefined. Relanza BloqueadoError.
export async function fetchShopMeta(origin: string, ctx: FetchCtx): Promise<string | undefined> {
  try {
    const meta = await politeFetch(`${origin}/meta.json`, ctx);
    if (meta.ok) return ((await meta.json()) as { currency?: string }).currency;
  } catch (e) {
    if (e instanceof BloqueadoError) throw e;
  }
  return undefined;
}

// Una página de /products.json (hasta 250 productos). La pausa entre páginas la maneja quien llama.
export async function fetchProductsPage(
  origin: string,
  page: number,
  ctx: FetchCtx,
): Promise<{ products: Product[]; rawCount: number }> {
  const res = await politeFetch(`${origin}/products.json?limit=250&page=${page}`, ctx);
  if (!res.ok)
    throw new CatalogSourceError("not_shopify", `La tienda respondió ${res.status} en /products.json. ¿Es una tienda Shopify?`);
  let body: { products?: ShopifyJson[] };
  try {
    body = (await res.json()) as { products?: ShopifyJson[] };
  } catch {
    throw new CatalogSourceError("bad_json", "La respuesta no es JSON. ¿Es una tienda Shopify?");
  }
  const batch = body.products ?? [];
  return { products: batch.map(fromShopifyJson), rawCount: batch.length };
}

// ───────────────────────────── CSV de Shopify ─────────────────────────────
// Parser CSV mínimo (comillas, comillas escapadas, saltos de línea dentro de celdas, BOM).
export function parseCsv(text: string): string[][] {
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

export function fromCsvText(text: string): Product[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new CatalogSourceError("csv_empty", "El CSV está vacío.");
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
    throw new CatalogSourceError(
      "csv_not_shopify",
      "No parece un CSV de productos de Shopify (faltan las columnas Handle y Title).",
    );
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
      description_html: get(first, col.body),
      product_type: `${get(first, col.type)} ${get(first, col.category)}`.trim(),
      tags: get(first, col.tags).split(","),
      price: prices.length ? Math.min(...prices) : null,
      colors: uniq(optNames.flatMap((n, k) => (n && isColorOption(n) ? optValues[k] : []))),
      sizes: uniq(optNames.flatMap((n, k) => (n && isSizeOption(n) ? optValues[k] : []))),
      image_url: imgs[0]?.src ?? null,
    });
  }
  return products;
}

// ───────────────────────────── fotos ─────────────────────────────
// Shopify sirve el original; pedimos 2000 px de ancho para que cada foto quede bajo el tope de 10 MB.
export function imageDownloadUrl(src: string): string {
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

export const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

// Descarga la foto principal. Devuelve la extensión y los bytes; el nombre del archivo lo arma quien llama.
export async function downloadPhoto(
  src: string,
  ctx: FetchCtx,
): Promise<{ ext: string; bytes: number; buf: Buffer }> {
  const url = imageDownloadUrl(src);
  let res = await politeFetch(url, { ...ctx, accept: "image/*,*/*" });
  if (!res.ok && url !== src)
    res = await politeFetch(new URL(src.startsWith("//") ? `https:${src}` : src).toString(), { ...ctx, accept: "image/*,*/*" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext =
    EXT_BY_TYPE[type] ?? (new URL(url).pathname.match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1].toLowerCase() ?? "jpg");
  const buf = Buffer.from(await res.arrayBuffer());
  return { ext: ext === "jpeg" ? "jpg" : ext, bytes: buf.length, buf };
}
