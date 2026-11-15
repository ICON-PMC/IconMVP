/**
 * Calcula la huella visual de las prendas publicadas para la búsqueda por foto (spec 005).
 * Marca como pendientes las que no tienen huella al día y las procesa en tandas.
 *
 * Uso:  npm run db:embed            (solo lo que falta)
 *       npm run db:embed -- --all   (reindexa todo, p. ej. al cambiar de modelo)
 * Lee .env.local. Para la nube: NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run db:embed
 * Necesita VISUAL_MODEL_URL (o el modelo ya en /tmp) y NEXT_PUBLIC_R2_PUBLIC_BASE.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { markPending, processPending } from "../src/lib/visual/index-garments";

function loadEnv(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* sin .env.local */
  }
}
loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const all = process.argv.includes("--all");
  if (all) {
    const { data } = await supabase.from("garments").select("id").eq("status", "published");
    const ids = (data ?? []).map((g) => g.id);
    for (let i = 0; i < ids.length; i += 100) await markPending(supabase, ids.slice(i, i + 100));
  }
  const marked = all ? 0 : await markPending(supabase);
  console.log(all ? "Reindexando todo el catálogo publicado…" : `Pendientes nuevas: ${marked}`);

  const total = { processed: 0, ready: 0, failed: 0 };
  const t0 = Date.now();
  for (;;) {
    const r = await processPending(supabase, { limit: 25 });
    total.processed += r.processed;
    total.ready += r.ready;
    total.failed += r.failed;
    if (r.processed) console.log(`  +${r.ready} listas, ${r.failed} con error`);
    if (r.processed === 0) break;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Listo en ${secs}s: ${total.ready} listas, ${total.failed} con error (${total.processed} procesadas).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
