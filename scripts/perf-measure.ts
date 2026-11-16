/**
 * Mide la velocidad de las páginas públicas con Lighthouse (perfil móvil por defecto: Moto G Power
 * emulado y 4G lenta simulada) y añade los resultados a specs/006-rendimiento/mediciones.md.
 *
 * Uso:  npm run perf:measure -- <url-base> [--fase A] [--runs 3] [--prenda <id>] [--post <id>] [--marca <slug>]
 * Ej.:  npm run perf:measure -- https://icon-iota-two.vercel.app --fase A-base
 *
 * Si no se pasan ids, se toman de los primeros enlaces que aparecen en /feed y /marcas.
 * Necesita Google Chrome instalado. No mide en `next dev` (los números no sirven): usar
 * `npm run build && npm start` o una URL desplegada.
 */
import { execFile } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { promisify } from "node:util";

// Lighthouse se corre por su CLI y no por su API: tsx compila con `keepNames` y Lighthouse inyecta
// funciones en la página, que fallan con "__name is not defined".
const run = promisify(execFile);

type Row = { page: string; path: string; lcp: number; ttfb: number; imgKb: number; cls: number };

const LOG = "specs/006-rendimiento/mediciones.md";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const base = process.argv.slice(2).find((a) => /^https?:\/\//.test(a))?.replace(/\/$/, "");
if (!base) {
  console.error("Uso: npm run perf:measure -- <url-base> [--fase nombre] [--runs 3]");
  process.exit(1);
}
const fase = arg("fase") ?? "sin-fase";
const runs = Math.max(1, Number(arg("runs") ?? 3));

async function firstLink(path: string, re: RegExp): Promise<string | null> {
  try {
    const html = await (await fetch(`${base}${path}`)).text();
    return html.match(re)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function pages(): Promise<{ page: string; path: string }[]> {
  const prenda = arg("prenda") ?? (await firstLink("/feed", /href="\/prenda\/([0-9a-f-]{36})/));
  const post = arg("post") ?? (await firstLink("/feed?type=posts", /href="\/post\/([0-9a-f-]{36})/));
  // La ficha de la prenda enlaza a su marca (`/marcas` es la landing para marcas y no lista ninguna).
  const marca =
    arg("marca") ??
    (prenda ? await firstLink(`/prenda/${prenda}`, /href="\/marca\/(?!panel")([A-Za-z0-9-]+)"/) : null);
  const list = [{ page: "feed", path: "/feed" }];
  if (prenda) list.push({ page: "prenda", path: `/prenda/${prenda}` });
  else console.warn("No se encontró una prenda; se omite.");
  if (post) list.push({ page: "post", path: `/post/${post}` });
  else console.warn("No se encontró un look publicado; se omite /post.");
  if (marca) list.push({ page: "marca", path: `/marca/${marca}` });
  else console.warn("No se encontró una marca; se omite.");
  return list;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

type NetItem = { resourceType?: string; transferSize?: number; networkRequestTime?: number };

type Audit = { numericValue?: number; details?: unknown };

async function measure(url: string): Promise<Omit<Row, "page" | "path">> {
  const { stdout } = await run(
    "node_modules/.bin/lighthouse",
    [url, "--output=json", "--quiet", "--only-categories=performance", '--chrome-flags=--headless=new'],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const a = (JSON.parse(stdout) as { audits: Record<string, Audit> }).audits;
  const lcp = a["largest-contentful-paint"]?.numericValue ?? NaN;
  const items = ((a["network-requests"]?.details as { items?: NetItem[] } | undefined)?.items ?? []) as NetItem[];
  // Imágenes pedidas antes del LCP ≈ las de la primera pantalla.
  const imgBytes = items
    .filter((i) => i.resourceType === "Image" && (i.networkRequestTime ?? Infinity) <= lcp)
    .reduce((sum, i) => sum + (i.transferSize ?? 0), 0);
  return {
    lcp,
    ttfb: a["server-response-time"]?.numericValue ?? NaN,
    imgKb: imgBytes / 1024,
    cls: a["cumulative-layout-shift"]?.numericValue ?? NaN,
  };
}

async function main() {
  const targets = await pages();
  const rows: Row[] = [];
  {
    for (const t of targets) {
      const samples: Omit<Row, "page" | "path">[] = [];
      for (let i = 0; i < runs; i++) {
        process.stdout.write(`${t.path} · corrida ${i + 1}/${runs}… `);
        samples.push(await measure(`${base}${t.path}`));
        console.log("ok");
      }
      rows.push({
        ...t,
        lcp: median(samples.map((s) => s.lcp)),
        ttfb: median(samples.map((s) => s.ttfb)),
        imgKb: median(samples.map((s) => s.imgKb)),
        cls: median(samples.map((s) => s.cls)),
      });
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  const env = new URL(base!).host;
  const lines = rows.map(
    (r) =>
      `| ${date} | ${fase} | ${env} | ${r.page} | ${(r.lcp / 1000).toFixed(2)} | ${Math.round(r.ttfb)} | ${Math.round(r.imgKb)} | ${r.cls.toFixed(3)} | ${r.path} |`,
  );
  console.log("\n" + lines.join("\n"));
  if (existsSync(LOG)) appendFileSync(LOG, lines.join("\n") + "\n");
  else console.warn(`No existe ${LOG}; los resultados solo se imprimieron.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
