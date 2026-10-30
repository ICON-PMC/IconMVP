// Corridas de lectura de catálogo (specs/001-catalog-scrape-bulk). El estado vive en la tabla
// `catalog_runs`; cada llamada a `advanceRun` hace una tanda acotada de trabajo (< ~40 s) para caber
// en el límite de duración de Vercel, y el navegador repite hasta terminar. Solo servidor, solo staff.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json, Tables } from "@/lib/database.types";
import { deleteFromR2, uploadToR2 } from "@/lib/r2";
import { slug } from "./catalog/infer";
import { productKey } from "./catalog/product-key";
import {
  BloqueadoError,
  CatalogInputError,
  assertPublicHttpUrl,
  buildUserAgent,
  isAllowedPhotoHost,
  sleep,
  type FetchCtx,
} from "./catalog/http";
import {
  CONTENT_TYPE_BY_EXT,
  CatalogSourceError,
  checkRobots,
  downloadPhoto,
  fetchProductsPage,
  fetchShopMeta,
  fromCsvText,
  type Product,
} from "./catalog/shopify";
import { loadVocabularyFromSupabase } from "./catalog/vocabulary";
import { buildWorkbook, type BuildStats } from "./catalog/workbook";

type Db = SupabaseClient<Database>;
export type CatalogRun = Tables<"catalog_runs">;

// Presupuesto de una tanda del servidor: deja margen bajo maxDuration = 60 s.
export const STEP_BUDGET_MS = 40_000;
export const MAX_PRODUCTS = 500;
export const MAX_CSV_BYTES = 10 * 1024 * 1024;
export const RUN_TTL_DAYS = 7;
const PHOTO_PAUSE_MS = 300;
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type RunOptions = { max: number | null; skip_photos: boolean; pause_ms: number };
type PackageKeys = { xlsx: string | null; origen: string | null; photos: string[] };

// Resultado de comparar la tienda con las prendas de la marca (solo lecturas en vivo completas).
export type ComparisonGarment = { garment_id: string; title: string; status: string; last_seen_at: string | null };
export type CatalogComparison = {
  computed_at: string;
  comparable: number;
  high_missing_ratio: boolean;
  siguen: { garment_id: string; title: string }[];
  nuevas: { handle: string; title: string }[];
  ya_no: ComparisonGarment[];
  reaparecen: ComparisonGarment[];
  sin_url: ComparisonGarment[];
};
// Si más de este porcentaje de las prendas comparables «ya no aparece», puede ser un fallo de lectura.
export const HIGH_MISSING_RATIO = 0.3;

export type RunSummary = {
  stats: BuildStats | null;
  unknownSizes: Record<string, number>;
  // Prendas con avisos para revisar en el Excel (misma información que la columna `revisar`).
  rows: { title: string; notes: string[] }[];
  currency: string | null;
  isComplete: boolean;
  comparison: CatalogComparison | null;
};

export type StartResult =
  | { ok: true; runId: string; phase: "reading" | "photos" | "building"; warnings: string[] }
  | { ok: false; error: string; hint?: "use_csv" };

export type AdvanceResult =
  | {
      ok: true;
      phase: "reading" | "photos" | "building" | "done";
      done: boolean;
      progress: { label: string; current: number; total: number | null };
      warnings: string[];
      summary?: RunSummary;
    }
  | { ok: false; error: string; retryable: boolean };

const asProducts = (j: Json): Product[] => (Array.isArray(j) ? (j as unknown as Product[]) : []);
const asKeys = (j: Json): PackageKeys => {
  const k = (j ?? {}) as Partial<PackageKeys>;
  return { xlsx: k.xlsx ?? null, origen: k.origen ?? null, photos: Array.isArray(k.photos) ? k.photos : [] };
};
const asOptions = (j: Json): RunOptions => {
  const o = (j ?? {}) as Partial<RunOptions>;
  return { max: o.max ?? null, skip_photos: !!o.skip_photos, pause_ms: o.pause_ms ?? 2000 };
};
const newExpiry = () => new Date(Date.now() + RUN_TTL_DAYS * 24 * 3600 * 1000).toISOString();
const r2Prefix = (runId: string) => `catalog-runs/${runId}`;

// ───────────────────────────── crear ─────────────────────────────
export type CreateRunInput = {
  userId: string;
  brandId: string;
  consent: boolean;
  url: string | null;
  csv: { name: string; text: string } | null;
  contact: string | null;
  max: number | null;
  skipPhotos: boolean;
  pauseMs: number | null;
};

export async function createRun(input: CreateRunInput, db?: Db): Promise<StartResult> {
  if (!input.consent)
    return { ok: false, error: "Confirma que la marca autorizó el uso de su catálogo y de sus fotos para poder continuar." };
  if (input.max != null && (!Number.isInteger(input.max) || input.max < 1))
    return { ok: false, error: "El límite de prendas debe ser un número entero mayor o igual a 1." };
  const pauseMs = input.pauseMs ?? 2000;
  if (!Number.isInteger(pauseMs) || pauseMs < 1000 || pauseMs > 10000)
    return { ok: false, error: "La pausa entre peticiones debe estar entre 1000 y 10000 milisegundos." };
  const contact = (input.contact?.trim() || process.env.CATALOG_BOT_CONTACT?.trim() || "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
    return {
      ok: false,
      error: "Falta un correo de contacto válido. Se muestra a la tienda para que sepa quién lee su catálogo.",
    };
  if (!input.url && !input.csv) return { ok: false, error: "Indica la dirección de la tienda o sube el CSV de productos." };
  if (input.csv && input.csv.text.length > MAX_CSV_BYTES)
    return { ok: false, error: "El CSV pesa más de 10 MB." };

  const supabase = db ?? (await createClient());
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, is_active")
    .eq("id", input.brandId)
    .maybeSingle();
  if (!brand) return { ok: false, error: "La marca no existe. Créala primero en el panel de administración." };
  if (!brand.is_active)
    return { ok: false, error: `«${brand.name}» no está activa. Actívala o apruébala antes de cargar su catálogo.` };

  const warnings: string[] = [];
  const userAgent = buildUserAgent(contact);
  const ctx: FetchCtx = { userAgent, guard: true };
  const sourceKind: "shop" | "csv" = input.csv ? "csv" : "shop";

  let origin: string | null = null;
  let currency: string | null = null;
  let products: Product[] = [];

  try {
    if (sourceKind === "shop") {
      origin = (await assertPublicHttpUrl(normalizeInputUrl(input.url!))).origin;
      // Con CSV no hay lectura en vivo: robots.txt solo importa cuando se lee /products.json.
      const robots = await checkRobots(origin, ctx);
      if (robots === "disallowed")
        return {
          ok: false,
          hint: "use_csv",
          error: "La tienda no permite la lectura automática de su catálogo. Pídele a la marca el CSV de productos.",
        };
      await sleep(pauseMs);
      currency = (await fetchShopMeta(origin, ctx)) ?? null;
    } else {
      if (input.url) {
        // Solo arma los enlaces de compra: no se hace ninguna petición a la tienda.
        const u = new URL(normalizeInputUrl(input.url));
        if (u.protocol !== "http:" && u.protocol !== "https:") throw new CatalogInputError("La dirección debe empezar por http:// o https://.");
        origin = u.origin;
      }
      products = fromCsvText(input.csv!.text);
      if (!products.length) return { ok: false, error: "No se encontraron productos activos en el CSV." };
      if (products.length > MAX_PRODUCTS) {
        products = products.slice(0, MAX_PRODUCTS);
        warnings.push(`El CSV tiene más de ${MAX_PRODUCTS} productos: se tomaron los primeros ${MAX_PRODUCTS}.`);
      }
      if (input.max) products = products.slice(0, input.max);
      for (const p of products)
        p.photo = { file: null, bytes: 0, status: !p.image_url ? "missing" : input.skipPhotos ? "skipped" : "pending" };
    }
  } catch (e) {
    if (e instanceof BloqueadoError)
      return {
        ok: false,
        hint: "use_csv",
        error: "La tienda está limitando las peticiones y no se pudo continuar. No insistas: pídele a la marca el CSV de productos.",
      };
    if (e instanceof CatalogInputError || e instanceof CatalogSourceError) return { ok: false, error: e.message };
    throw e;
  }

  const phase = sourceKind === "shop" ? "reading" : input.skipPhotos ? "building" : "photos";
  const options: RunOptions = { max: input.max, skip_photos: input.skipPhotos, pause_ms: pauseMs };
  const { data: row, error } = await supabase
    .from("catalog_runs")
    .insert({
      brand_id: brand.id,
      created_by: input.userId,
      source_kind: sourceKind,
      origin,
      source_label: sourceKind === "shop" ? `${origin}/products.json` : `csv:${input.csv!.name}`,
      consent_confirmed: true,
      contact,
      options: options as unknown as Json,
      phase,
      cursor: phase === "reading" ? 1 : 0,
      currency,
      products: products as unknown as Json,
      // Una corrida desde CSV nunca es "completa" para la comparación con la tienda (FR-022).
      is_complete: false,
      expires_at: newExpiry(),
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: `No se pudo crear la corrida: ${error?.message ?? "respuesta inesperada"}` };
  return { ok: true, runId: row.id, phase, warnings };
}

// "tienda.com" → "https://tienda.com"
function normalizeInputUrl(raw: string): string {
  const v = raw.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

// ───────────────────────────── avanzar ─────────────────────────────
async function loadRun(supabase: Db, runId: string): Promise<CatalogRun | null> {
  const { data } = await supabase.from("catalog_runs").select("*").eq("id", runId).maybeSingle();
  return data ?? null;
}

// Compare-and-set sobre (id, fase, cursor): si dos pestañas avanzan a la vez, solo una gana.
async function casUpdate(supabase: Db, run: CatalogRun, patch: Partial<CatalogRun>): Promise<boolean> {
  const { data, error } = await supabase
    .from("catalog_runs")
    .update(patch)
    .eq("id", run.id)
    .eq("phase", run.phase)
    .eq("cursor", run.cursor)
    .select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

function progressOf(run: CatalogRun): { label: string; current: number; total: number | null } {
  const total = asProducts(run.products).length;
  switch (run.phase) {
    case "reading":
      return { label: "Leyendo el catálogo de la tienda…", current: total, total: null };
    case "photos":
      return { label: "Descargando fotos", current: Math.min(run.cursor, total), total };
    case "building":
      return { label: "Armando el Excel…", current: total, total };
    default:
      return { label: "Listo", current: total, total };
  }
}

export function summaryOf(run: CatalogRun): RunSummary {
  const products = asProducts(run.products);
  const stats = run.stats && Object.keys(run.stats as object).length ? (run.stats as unknown as BuildStats) : null;
  return {
    stats,
    unknownSizes: (run.unknown_sizes ?? {}) as Record<string, number>,
    rows: products.filter((p) => p.notes?.length).map((p) => ({ title: p.title, notes: p.notes! })),
    currency: run.currency,
    isComplete: run.is_complete,
    comparison: (run.comparison as unknown as CatalogComparison | null) ?? null,
  };
}

async function result(supabase: Db, runId: string, warnings: string[]): Promise<AdvanceResult> {
  const run = await loadRun(supabase, runId);
  if (!run) return { ok: false, error: "La corrida ya no existe.", retryable: false };
  if (run.phase === "failed") return { ok: false, error: run.error ?? "La corrida falló.", retryable: false };
  if (run.phase === "discarded") return { ok: false, error: "La corrida fue descartada.", retryable: false };
  const done = run.phase === "done";
  return {
    ok: true,
    phase: run.phase as "reading" | "photos" | "building" | "done",
    done,
    progress: progressOf(run),
    warnings,
    summary: done ? summaryOf(run) : undefined,
  };
}

async function failRun(supabase: Db, run: CatalogRun, message: string): Promise<AdvanceResult> {
  await supabase
    .from("catalog_runs")
    .update({ phase: "failed", error: message, finished_at: new Date().toISOString() })
    .eq("id", run.id);
  return { ok: false, error: message, retryable: false };
}

// Una tanda de trabajo. Idempotente y segura ante pestañas simultáneas.
export async function advanceRun(runId: string, db?: Db): Promise<AdvanceResult> {
  const supabase = db ?? (await createClient());
  const run = await loadRun(supabase, runId);
  if (!run) return { ok: false, error: "La corrida no existe o venció.", retryable: false };
  // Una corrida vencida ya no es utilizable (sus archivos temporales se purgan), aunque haya terminado.
  if (run.phase !== "discarded" && new Date(run.expires_at).getTime() < Date.now())
    return { ok: false, error: "La corrida venció (7 días). Empieza una nueva.", retryable: false };
  if (run.phase === "done" || run.phase === "failed" || run.phase === "discarded") return result(supabase, runId, []);

  const warnings: string[] = [];
  try {
    if (run.phase === "reading") await stepReading(supabase, run, warnings);
    else if (run.phase === "photos") await stepPhotos(supabase, run, warnings);
    else if (run.phase === "building") await stepBuilding(supabase, run);
  } catch (e) {
    if (e instanceof BloqueadoError)
      return failRun(
        supabase,
        run,
        "La tienda está limitando las peticiones y no se pudo continuar. No insistas: pídele a la marca el CSV de productos.",
      );
    if (e instanceof CatalogSourceError) return failRun(supabase, run, `${e.message} Prueba con el CSV de la marca.`);
    if (e instanceof CatalogInputError) return failRun(supabase, run, e.message);
    console.error("[catalog-runs] tanda falló:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Hubo un problema de conexión. Se reintentará.", retryable: true };
  }
  return result(supabase, runId, warnings);
}

// ── reading: una página de /products.json por tanda ──
async function stepReading(supabase: Db, run: CatalogRun, warnings: string[]) {
  const options = asOptions(run.options);
  const ctx: FetchCtx = { userAgent: buildUserAgent(run.contact), guard: true, onWait: (m) => warnings.push(m) };
  const products = asProducts(run.products);
  const seen = new Set(products.map((p) => p.handle));

  await sleep(options.pause_ms);
  const batch = await fetchProductsPage(run.origin!, run.cursor, ctx);
  for (const p of batch.products) {
    if (seen.has(p.handle)) continue;
    seen.add(p.handle);
    products.push(p);
  }

  let capped = false;
  let finished = batch.rawCount < 250;
  if (options.max && products.length >= options.max) {
    products.length = options.max;
    finished = true;
  } else if (products.length >= MAX_PRODUCTS) {
    products.length = MAX_PRODUCTS;
    capped = true;
    finished = true;
    warnings.push(`La tienda tiene más de ${MAX_PRODUCTS} productos: se tomaron los primeros ${MAX_PRODUCTS}.`);
  }

  if (!finished) {
    await casUpdate(supabase, run, { cursor: run.cursor + 1, products: products as unknown as Json, expires_at: newExpiry() });
    return;
  }
  if (!products.length) {
    await supabase
      .from("catalog_runs")
      .update({ phase: "failed", error: "No se encontraron productos.", finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return;
  }
  for (const p of products)
    p.photo = { file: null, bytes: 0, status: !p.image_url ? "missing" : options.skip_photos ? "skipped" : "pending" };
  await casUpdate(supabase, run, {
    phase: options.skip_photos ? "building" : "photos",
    cursor: 0,
    products: products as unknown as Json,
    // Solo una lectura completa de toda la tienda habilita la comparación (FR-022).
    is_complete: !options.max && !capped,
    expires_at: newExpiry(),
  });
}

// ── photos: descarga hasta agotar el presupuesto ──
async function stepPhotos(supabase: Db, run: CatalogRun, warnings: string[]) {
  const ctx: FetchCtx = { userAgent: buildUserAgent(run.contact), guard: true, onWait: (m) => warnings.push(m) };
  const products = asProducts(run.products);
  const keys = asKeys(run.package_keys);
  const deadline = Date.now() + STEP_BUDGET_MS;
  let i = run.cursor;
  let blocked = false;

  while (i < products.length && Date.now() < deadline) {
    const p = products[i];
    if (!p.image_url) {
      p.photo = { file: null, bytes: 0, status: "missing" };
      i++;
      continue;
    }
    if (p.photo?.status === "ok") {
      i++;
      continue;
    }
    if (blocked) {
      p.photo = { file: null, bytes: 0, status: "blocked" };
      i++;
      continue;
    }
    if (!isAllowedPhotoHost(p.image_url, run.origin)) {
      p.photo = { file: null, bytes: 0, status: "failed" };
      i++;
      continue;
    }
    try {
      const { ext, bytes, buf } = await downloadPhoto(p.image_url, ctx);
      const file = `${String(i + 1).padStart(3, "0")}-${slug(p.title).slice(0, 50)}.${ext}`;
      const key = `${r2Prefix(run.id)}/fotos/${file}`;
      await uploadToR2(key, buf, CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream");
      if (!keys.photos.includes(key)) keys.photos.push(key);
      p.photo = { file, bytes, status: "ok" };
      await sleep(PHOTO_PAUSE_MS);
    } catch (e) {
      if (e instanceof BloqueadoError) {
        blocked = true;
        warnings.push("La tienda pidió frenar; se omiten las fotos restantes.");
        p.photo = { file: null, bytes: 0, status: "blocked" };
      } else {
        p.photo = { file: null, bytes: 0, status: "failed" };
      }
    }
    i++;
  }

  const finished = i >= products.length;
  await casUpdate(supabase, run, {
    phase: finished ? "building" : "photos",
    cursor: finished ? 0 : i,
    products: products as unknown as Json,
    package_keys: keys as unknown as Json,
    expires_at: newExpiry(),
  });
}

// ── building: Excel + origen.json ──
async function stepBuilding(supabase: Db, run: CatalogRun) {
  const products = asProducts(run.products);
  const keys = asKeys(run.package_keys);
  const { data: brand } = await supabase.from("brands").select("id, name").eq("id", run.brand_id).maybeSingle();
  if (!brand) throw new CatalogInputError("La marca de esta corrida ya no existe.");

  const vocab = await loadVocabularyFromSupabase(supabase);
  const generatedAt = new Date().toISOString();
  const { workbook, stats, unknownSizes, rowNotes } = buildWorkbook({
    brandName: brand.name,
    products,
    vocab,
    origin: run.origin,
    currency: run.currency ?? undefined,
    run: { runId: run.id, brandId: run.brand_id, generatedAt },
  });
  products.forEach((p, idx) => {
    p.notes = rowNotes[idx];
  });

  const xlsxKey = `${r2Prefix(run.id)}/catalogo.xlsx`;
  const origenKey = `${r2Prefix(run.id)}/origen.json`;
  const xlsx = new Uint8Array(await workbook.xlsx.writeBuffer());
  await uploadToR2(xlsxKey, xlsx, XLSX_TYPE);
  await uploadToR2(
    origenKey,
    JSON.stringify(
      {
        marca: brand.name,
        marca_id: brand.id,
        run_id: run.id,
        fuente: run.source_label,
        fecha: generatedAt,
        consentimiento_confirmado_por_quien_ejecuto: true,
        responsable: run.created_by,
        contacto: run.contact,
        moneda_reportada_por_la_tienda: run.currency ?? "desconocida",
        productos: products.length,
        fotos_descargadas: stats.photos,
        lectura_completa: run.is_complete,
      },
      null,
      2,
    ),
    "application/json",
  );

  // Comparación con las prendas de la marca: solo si se leyó TODA la tienda en vivo, sin límite de N (FR-022).
  let comparison: CatalogComparison | null = null;
  if (run.source_kind === "shop" && run.is_complete && !asOptions(run.options).max)
    comparison = await computeComparison(supabase, run, products, generatedAt);

  await casUpdate(supabase, run, {
    phase: "done",
    cursor: 0,
    comparison: comparison as unknown as Json,
    products: products as unknown as Json,
    stats: stats as unknown as Json,
    unknown_sizes: unknownSizes as unknown as Json,
    package_keys: { ...keys, xlsx: xlsxKey, origen: origenKey } as unknown as Json,
    finished_at: generatedAt, // misma fecha que last_seen_at de la comparación y de las prendas importadas
    expires_at: newExpiry(),
  });
}

// ───────────────────────────── descartar ─────────────────────────────
// Borra los objetos del almacén temporal y la fila; si la corrida ya tiene importación o acciones
// registradas, la fila se conserva marcada como `discarded` (es el registro de procedencia).
export async function discardRun(runId: string, db?: Db): Promise<{ ok: boolean; error?: string }> {
  const supabase = db ?? (await createClient());
  const run = await loadRun(supabase, runId);
  if (!run) return { ok: true };
  const keys = asKeys(run.package_keys);
  await deleteFromR2([...keys.photos, keys.xlsx, keys.origen]);
  const actions = Array.isArray(run.actions) ? run.actions : [];
  if (run.imported_at || actions.length) {
    const { error } = await supabase
      .from("catalog_runs")
      .update({
        phase: "discarded",
        products: [] as unknown as Json,
        package_keys: { xlsx: null, origen: null, photos: [] } as unknown as Json,
      })
      .eq("id", runId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const { error } = await supabase.from("catalog_runs").delete().eq("id", runId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ───────────────────────────── purga ─────────────────────────────
// Borra los archivos temporales y las corridas vencidas (7 días). Las que ya tienen importación o
// acciones registradas se conservan como `discarded`. Tolerante a fallos: un archivo que no se pueda
// borrar se registra y se sigue. Se llama de forma oportunista al abrir /admin/bulk.
export async function purgeExpiredRuns(db?: Db, limit = 20): Promise<number> {
  const supabase = db ?? (await createClient());
  const { data } = await supabase
    .from("catalog_runs")
    .select("id")
    .lt("expires_at", new Date().toISOString())
    .neq("phase", "discarded")
    .order("expires_at")
    .limit(limit);
  let purged = 0;
  for (const run of data ?? []) {
    try {
      const res = await discardRun(run.id, supabase);
      if (res.ok) purged++;
    } catch (e) {
      console.error("[catalog-runs] no se pudo purgar", run.id, e instanceof Error ? e.message : e);
    }
  }
  return purged;
}

// ───────────────────────────── comparación con la tienda ─────────────────────────────
// Cruza (marca + clave del enlace de compra) las prendas de la marca con lo que la tienda ofrece hoy.
// Actualiza `last_seen_at` de las que siguen. NO archiva nada: eso lo decide el staff (FR-023).
async function computeComparison(
  supabase: Db,
  run: CatalogRun,
  products: Product[],
  computedAt: string,
): Promise<CatalogComparison> {
  // Prendas activas (pending/published) y las archivadas por esta vía (para detectar «reaparecen»).
  const garments: { id: string; title: string; status: string; product_url: string | null; last_seen_at: string | null; discontinued_at: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("garments")
      .select("id, title, status, product_url, last_seen_at, discontinued_at")
      .eq("brand_id", run.brand_id)
      .or("status.in.(pending,published),and(status.eq.archived,discontinued_at.not.is.null)")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    garments.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }

  const store = new Map<string, Product>();
  for (const p of products) {
    const k = productKey(`${run.origin ?? "https://tienda.invalid"}/products/${encodeURIComponent(p.handle)}`);
    if (k) store.set(k, p);
  }

  const cmp: CatalogComparison = {
    computed_at: computedAt,
    comparable: 0,
    high_missing_ratio: false,
    siguen: [],
    nuevas: [],
    ya_no: [],
    reaparecen: [],
    sin_url: [],
  };
  const matched = new Set<string>();
  for (const g of garments) {
    const archived = g.status === "archived";
    const k = productKey(g.product_url);
    const item: ComparisonGarment = { garment_id: g.id, title: g.title, status: g.status, last_seen_at: g.last_seen_at };
    if (!k) {
      if (!archived) cmp.sin_url.push(item);
      continue;
    }
    const inStore = store.has(k);
    if (inStore) matched.add(k);
    if (archived) {
      if (inStore) cmp.reaparecen.push(item);
    } else {
      cmp.comparable++;
      if (inStore) cmp.siguen.push({ garment_id: g.id, title: g.title });
      else cmp.ya_no.push(item);
    }
  }
  for (const [k, p] of store) if (!matched.has(k)) cmp.nuevas.push({ handle: p.handle, title: p.title });
  cmp.high_missing_ratio = cmp.comparable > 0 && cmp.ya_no.length / cmp.comparable > HIGH_MISSING_RATIO;

  // last_seen_at en lote (sin tocar updated_at: lo garantiza el trigger de la migración).
  const ids = cmp.siguen.map((g) => g.garment_id);
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase.from("garments").update({ last_seen_at: computedAt }).in("id", ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }
  return cmp;
}
