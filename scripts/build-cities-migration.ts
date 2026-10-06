/**
 * Genera supabase/migrations/20261006020000_colombia_cities.sql a partir de
 * supabase/data/divipola.csv (DANE, "DIVIPOLA- Códigos municipios", datos.gov.co gdxc-w37w).
 *
 * Uso:  npx tsx scripts/build-cities-migration.ts
 *
 * El CSV viene en mayúsculas ("SAN JOSÉ DE CÚCUTA"); se pasa a "San José de Cúcuta".
 * Slug: nombre sin acentos; si el nombre se repite en otro departamento, todas sus filas
 * llevan "nombre-departamento". Bogotá, Medellín y Barranquilla conservan sus slugs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const csvPath = join(root, "supabase/data/divipola.csv");
const outPath = join(root, "supabase/migrations/20261006020000_colombia_cities.sql");

// Nombres que ya existen en la base con otra forma (el CSV dice "BOGOTÁ, D.C.").
const NAME_OVERRIDES: Record<string, string> = { "11001": "Bogotá" };
// Departamento con nombre oficial demasiado largo para un slug.
const DEPT_SLUG: Record<string, string> = {
  "Archipiélago de San Andrés, Providencia y Santa Catalina": "san-andres",
};
const LOWER_WORDS = new Set(["de", "del", "la", "las", "los", "y", "e", "el"]);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w, i) => {
      if (/^\s+$|^-$/.test(w) || w === "") return w;
      if (/^[a-z]\.([a-z]\.)*$/.test(w.replace(/,$/, ""))) return w.toUpperCase(); // "d.c."
      if (i > 0 && LOWER_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("");
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1]));
}

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const header = rows.shift()!;
const idx = (col: string) => {
  const i = header.indexOf(col);
  if (i < 0) throw new Error(`Columna ${col} no está en el CSV`);
  return i;
};
const [iDpto, iCode, iName] = [idx("dpto"), idx("cod_mpio"), idx("nom_mpio")];

const cities = rows.map((r) => {
  const code = r[iCode];
  const department = titleCase(r[iDpto]);
  const name = NAME_OVERRIDES[code] ?? titleCase(r[iName]);
  return { code, name, department };
});

const byName = new Map<string, number>();
for (const c of cities) byName.set(slugify(c.name), (byName.get(slugify(c.name)) ?? 0) + 1);

const withSlugs = cities.map((c) => {
  const base = slugify(c.name);
  const slug = (byName.get(base) ?? 0) > 1 ? `${base}-${DEPT_SLUG[c.department] ?? slugify(c.department)}` : base;
  return { ...c, slug };
});

const slugs = new Set<string>();
for (const c of withSlugs) {
  if (slugs.has(c.slug)) throw new Error(`Slug repetido: ${c.slug}`);
  slugs.add(c.slug);
}
for (const [code, slug] of [["11001", "bogota"], ["05001", "medellin"], ["08001", "barranquilla"]]) {
  const c = withSlugs.find((x) => x.code === code);
  if (c?.slug !== slug) throw new Error(`${code} debería tener slug ${slug}, tiene ${c?.slug}`);
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const values = withSlugs
  .sort((a, b) => a.code.localeCompare(b.code))
  .map((c) => `    (${q(c.code)}, ${q(c.name)}, ${q(c.department)}, ${q(c.slug)})`)
  .join(",\n");

const sql = `-- Todos los municipios de Colombia (DIVIPOLA del DANE) con su departamento.
-- Spec: specs/2026-10-06-etiquetas-ciudades-busqueda/plan.md, 1e.
-- GENERADO por scripts/build-cities-migration.ts desde supabase/data/divipola.csv
-- (${withSlugs.length} filas). No editar a mano: corregir el script y regenerar.
--
-- Las 3 ciudades que ya existían (Bogotá, Medellín, Barranquilla) conservan id y slug:
-- se completan por slug y el insert las salta. Idempotente.

alter table cities
  add column if not exists department text,
  add column if not exists dane_code  text unique;

-- Un solo statement con CTE (sin tabla temporal): el SQL Editor de Supabase no conserva una
-- tabla temporal entre statements. El update completa las 3 ciudades existentes; el insert
-- choca con sus slugs y las salta.
with divipola (dane_code, name, department, slug) as (
  values
${values}
),
completar as (
  update cities c
  set dane_code = d.dane_code, department = d.department
  from divipola d
  where c.slug = d.slug and c.dane_code is null
  returning c.id
)
insert into cities (dane_code, name, department, slug)
select dane_code, name, department, slug from divipola
on conflict do nothing;

-- Búsqueda del combobox ("medellin" sin tilde, subcadenas).
create index if not exists cities_name_trgm
  on cities using gin (public.f_unaccent(lower(name)) extensions.gin_trgm_ops);
`;

writeFileSync(outPath, sql);
console.log(`${withSlugs.length} municipios -> ${outPath}`);
const repeated = withSlugs.filter((c) => c.slug.includes("-") && (byName.get(slugify(c.name)) ?? 0) > 1);
console.log(`${repeated.length} con slug nombre-departamento, p. ej.: ${repeated.slice(0, 4).map((c) => c.slug).join(", ")}`);
