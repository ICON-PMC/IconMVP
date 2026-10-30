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
 * La lógica vive en src/lib/catalog/ (la comparte el panel /admin/bulk); este archivo solo
 * lee los flags, imprime el avance y escribe los archivos.
 * Detalle completo: docs/importar-catalogo.md
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { norm, slug } from "../src/lib/catalog/infer";
import { BloqueadoError, buildUserAgent, sleep, type FetchCtx } from "../src/lib/catalog/http";
import {
  CatalogSourceError,
  checkRobots,
  downloadPhoto,
  fetchProductsPage,
  fetchShopMeta,
  fromCsvText,
  type Product,
} from "../src/lib/catalog/shopify";
import { FALLBACK_VOCABULARY, loadVocabularyRest, type Vocabulary } from "../src/lib/catalog/vocabulary";
import { buildWorkbook } from "../src/lib/catalog/workbook";

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

// El CLI corre en el equipo de quien lo ejecuta: no necesita la guarda de redes privadas del panel.
const ctx: FetchCtx = {
  userAgent: buildUserAgent(CONTACTO),
  guard: false,
  onWait: (m) => console.log(`  ⏳ ${m}`),
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
  return loadVocabularyRest({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

// ───────────────────────────── fuente: tienda en vivo ─────────────────────────────
async function fetchLive(origin: string): Promise<{ products: Product[]; currency?: string; source: string }> {
  const robots = await checkRobots(origin, ctx);
  if (robots === "disallowed")
    die("El robots.txt de la tienda NO permite leer /products.json. Pídele a la marca el CSV (--csv).");
  if (robots === "unknown") console.log("  (no se pudo leer robots.txt; se continúa con cuidado)");

  await sleep(PAUSA);
  const currency = await fetchShopMeta(origin, ctx);

  const products: Product[] = [];
  const seen = new Set<string>();
  for (let page = 1; ; page++) {
    await sleep(PAUSA);
    let batch: { products: Product[]; rawCount: number };
    try {
      batch = await fetchProductsPage(origin, page, ctx);
    } catch (e) {
      if (e instanceof CatalogSourceError) die(`${e.message} Prueba con --csv.`);
      throw e;
    }
    for (const p of batch.products) {
      if (!seen.has(p.handle)) {
        seen.add(p.handle);
        products.push(p);
      }
    }
    console.log(`  Página ${page}: ${batch.rawCount} productos (${products.length} en total)`);
    if (batch.rawCount < 250 || (MAX && products.length >= MAX)) break;
  }
  return { products, currency, source: `${origin}/products.json` };
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
    try {
      products = fromCsvText(readFileSync(CSV_PATH, "utf8"));
    } catch (e) {
      if (e instanceof CatalogSourceError) die(e.message);
      throw e;
    }
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

  // Fotos: se descargan una por una (con pausa) y se anota el resultado en cada producto; los avisos de la
  // columna «revisar» los arma buildWorkbook a partir de ese estado.
  let fotosBloqueadas = false;
  let fotosOk = 0;
  for (const [i, p] of products.entries()) {
    if (!p.image_url) {
      p.photo = { file: null, bytes: 0, status: "missing" };
    } else if (SIN_FOTOS) {
      p.photo = { file: null, bytes: 0, status: "skipped" };
    } else if (fotosBloqueadas) {
      p.photo = { file: null, bytes: 0, status: "blocked" };
    } else {
      try {
        const base = `${String(i + 1).padStart(3, "0")}-${slug(p.title).slice(0, 50)}`;
        const { ext, bytes, buf } = await downloadPhoto(p.image_url, ctx);
        const file = `${base}.${ext}`;
        writeFileSync(join(photosDir, file), buf);
        p.photo = { file, bytes, status: "ok" };
        fotosOk++;
        process.stdout.write(`\r  Fotos: ${fotosOk}/${products.length}   `);
        await sleep(300);
      } catch (e) {
        if (e instanceof BloqueadoError) {
          fotosBloqueadas = true;
          console.log("\n  ⚠ El servidor de imágenes pidió frenar; se omiten las fotos restantes.");
          p.photo = { file: null, bytes: 0, status: "blocked" };
        } else {
          p.photo = { file: null, bytes: 0, status: "failed" };
        }
      }
    }
  }
  if (!SIN_FOTOS) process.stdout.write("\n");

  const { workbook, stats, unknownSizes } = buildWorkbook({
    brandName: MARCA!,
    products,
    vocab,
    origin: ORIGIN,
    currency,
  });

  const xlsxPath = join(outDir, "catalogo.xlsx");
  await workbook.xlsx.writeFile(xlsxPath);

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
        fotos_descargadas: stats.photos,
      },
      null,
      2,
    ),
  );

  console.log(`\n✓ ${products.length} productos`);
  console.log(`  Excel:  ${xlsxPath}`);
  if (!SIN_FOTOS) console.log(`  Fotos:  ${photosDir}  (${stats.photos} descargadas)`);
  console.log(`  Etiquetas prellenadas desde la tienda: ${stats.with_style} con estilo · ${stats.with_occasion} con ocasión · ${stats.with_climate} con clima (el resto, a elegir en el Excel)`);
  console.log(`  A revisar: ${stats.no_category} sin categoría · ${stats.no_size} sin talla · ${stats.no_price} sin precio · ${stats.no_photo} sin foto`);
  const unknownEntries = Object.entries(unknownSizes);
  if (unknownEntries.length) {
    const lista = unknownEntries.map(([t, c]) => `${t} (${c})`).join(", ");
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
