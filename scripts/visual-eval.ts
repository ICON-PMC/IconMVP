/**
 * Evalúa la búsqueda por foto con el set de referencia (spec 005, SC-001) y sugiere umbrales.
 *
 * Set: specs/005-busqueda-por-foto/referencia/ con las fotos y un esperado.json:
 *   [{ "archivo": "jean-calle.jpg", "categoria": "jeans", "garmentId": "uuid opcional" }, …]
 *   - con garmentId: foto de una prenda del catálogo → debe salir primera (meta 90 %)
 *   - sin garmentId: inspiración externa → algo de su categoría en el top 6 (meta 80 %)
 *
 * Uso: npm run visual:eval   (lee .env.local; necesita VISUAL_MODEL_URL y service role de la
 *      base que tenga el catálogo indexado, p. ej. la nube con NEXT_PUBLIC_SUPABASE_URL=… delante)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { embedImage, toPgVector } from "../src/lib/visual/embed";
import { rankCategories } from "../src/lib/visual/classify";
import { SIMILAR_MIN } from "../src/lib/visual/thresholds";

for (const line of (() => {
  try {
    return readFileSync(".env.local", "utf8").split("\n");
  } catch {
    return [];
  }
})()) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const DIR = "specs/005-busqueda-por-foto/referencia";
type Case = { archivo: string; categoria: string; garmentId?: string };

async function main() {
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const cases = JSON.parse(readFileSync(path.join(DIR, "esperado.json"), "utf8")) as Case[];
  let own = 0, ownOk = 0, ext = 0, extOk = 0;
  const tops: number[] = [];
  for (const c of cases) {
    const vec = await embedImage(readFileSync(path.join(DIR, c.archivo)));
    const cat = rankCategories(vec)[0].slug;
    const { data: hits } = await supabase.rpc("search_by_embedding", {
      p_embedding: toPgVector(vec),
      p_limit: 6,
      p_prefer_category: cat,
    });
    const ids = (hits ?? []).map((h) => h.id);
    const { data: rows } = await supabase.from("feed_items").select("id, title, categories").in("id", ids);
    const byId = new Map((rows ?? []).map((r) => [r.id, r]));
    const top6 = ids.map((id) => byId.get(id));
    tops.push(hits?.[0]?.similarity ?? 0);
    let ok: boolean;
    if (c.garmentId) {
      own++;
      ok = ids[0] === c.garmentId;
      if (ok) ownOk++;
    } else {
      ext++;
      ok = top6.some((r) => r?.categories?.includes(c.categoria));
      if (ok) extOk++;
    }
    console.log(`${ok ? "✓" : "✗"} ${c.archivo} → ${top6[0]?.title ?? "—"} (${(hits?.[0]?.similarity ?? 0).toFixed(3)}) · detectada ${cat}`);
  }
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : "—");
  console.log(`\nDel catálogo, la propia primera: ${pct(ownOk, own)} (meta 90 %)`);
  console.log(`Externas, su categoría en el top 6: ${pct(extOk, ext)} (meta 80 %)`);
  console.log(`Total SC-001: ${pct(ownOk + extOk, own + ext)} (meta 80 %)`);
  const sorted = [...tops].sort((a, b) => a - b);
  console.log(`Similitud del 1.º resultado p25/p50: ${sorted[Math.floor(sorted.length / 4)]?.toFixed(3)} / ${sorted[Math.floor(sorted.length / 2)]?.toFixed(3)} · SIMILAR_MIN actual ${SIMILAR_MIN}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
