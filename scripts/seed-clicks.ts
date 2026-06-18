/**
 * Siembra clics salientes de muestra (para demostrar analítica + score).
 * Inserta un número aleatorio de clics por prenda taggeada en posts.
 * El trigger de popularidad se encarga de subir posts.popularity.
 *
 * Uso:  npm run db:seed-clicks
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

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
const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !sr) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient<Database>(url, sr, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SOURCES: Database["public"]["Enums"]["click_source"][] = [
  "feed",
  "post",
  "garment",
  "brand_profile",
];

async function main() {
  const { data: items, error } = await supabase
    .from("post_items")
    .select("post_id, garment_id");
  if (error) throw new Error(error.message);

  const gids = [...new Set((items ?? []).map((i) => i.garment_id))];
  const { data: garments } = await supabase
    .from("garments")
    .select("id, brand_id")
    .in("id", gids);
  const brandOf = new Map((garments ?? []).map((g) => [g.id, g.brand_id]));

  const rows: Database["public"]["Tables"]["outbound_clicks"]["Insert"][] = [];
  for (const it of items ?? []) {
    const n = 1 + Math.floor(Math.random() * 10);
    for (let k = 0; k < n; k++) {
      rows.push({
        garment_id: it.garment_id,
        brand_id: brandOf.get(it.garment_id) ?? null,
        post_id: it.post_id,
        source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
      });
    }
  }

  let total = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error: e } = await supabase.from("outbound_clicks").insert(chunk);
    if (e) throw new Error(e.message);
    total += chunk.length;
  }
  console.log(`✓ ${total} clics de muestra insertados (${(items ?? []).length} prendas en posts).`);
}

main().catch((err) => {
  console.error("\n✗ Error:", err.message);
  process.exit(1);
});
