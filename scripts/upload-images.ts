/**
 * Migra a Cloudflare R2 las imágenes que aún apuntan a una URL externa (ej. Unsplash).
 * Descarga, redimensiona (máx 1280px, WebP) y sube; luego guarda la clave de R2 en cf_image_id.
 *
 * Uso:  npm run db:upload-images
 * Idempotente: las que ya son claves de R2 (no http) se omiten.
 */
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { uploadToR2 } from "../src/lib/r2";

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

const isHttp = (s: string) => /^https?:\/\//.test(s);

async function processAndUpload(srcUrl: string, key: string) {
  const resp = await fetch(srcUrl);
  if (!resp.ok) throw new Error(`descarga ${srcUrl}: ${resp.status}`);
  const input = Buffer.from(await resp.arrayBuffer());
  const out = await sharp(input)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  await uploadToR2(key, out, "image/webp");
}

async function migrateGarmentImages(): Promise<number> {
  const { data, error } = await supabase
    .from("garment_images")
    .select("id, garment_id, cf_image_id, position");
  if (error) throw new Error(error.message);
  let n = 0;
  for (const row of data ?? []) {
    if (!isHttp(row.cf_image_id)) continue;
    const key = `garments/${row.garment_id}/${row.position}.webp`;
    await processAndUpload(row.cf_image_id, key);
    const upd = await supabase
      .from("garment_images")
      .update({ cf_image_id: key })
      .eq("id", row.id);
    if (upd.error) throw new Error(upd.error.message);
    n++;
    console.log(`  ↑ ${key}`);
  }
  return n;
}

async function migratePostImages(): Promise<number> {
  const { data, error } = await supabase
    .from("post_images")
    .select("id, post_id, cf_image_id, position");
  if (error) throw new Error(error.message);
  let n = 0;
  for (const row of data ?? []) {
    if (!isHttp(row.cf_image_id)) continue;
    const key = `posts/${row.post_id}/${row.position}.webp`;
    await processAndUpload(row.cf_image_id, key);
    const upd = await supabase
      .from("post_images")
      .update({ cf_image_id: key })
      .eq("id", row.id);
    if (upd.error) throw new Error(upd.error.message);
    n++;
    console.log(`  ↑ ${key}`);
  }
  return n;
}

async function main() {
  console.log("→ Subiendo imágenes a R2...\n");
  const g = await migrateGarmentImages();
  const p = await migratePostImages();
  console.log(`\n✓ ${g} imágenes de prenda y ${p} de post subidas a R2.`);
}

main().catch((err) => {
  console.error("\n✗ Error:", err.message);
  process.exit(1);
});
