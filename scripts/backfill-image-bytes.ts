/**
 * Rellena el peso (bytes) de las imágenes subidas antes de la cuota de almacenamiento
 * (migración 20260926010000_storage_quota.sql): garment_images.bytes, post_images.bytes
 * y brands.logo_bytes. Lee el Content-Length de cada objeto en R2 con un HEAD a la URL pública.
 *
 * Uso:  npm run db:backfill-image-bytes
 * Idempotente: solo toca filas con bytes = 0 y clave de R2 (no URLs externas).
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const r2Base = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ?? "").replace(/\/$/, "");
if (!url || !serviceKey || !r2Base) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y/o NEXT_PUBLIC_R2_PUBLIC_BASE.");
  process.exit(1);
}
const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isHttp = (s: string) => /^https?:\/\//.test(s);

async function sizeOf(key: string): Promise<number | null> {
  const res = await fetch(`${r2Base}/${key.replace(/^\//, "")}`, { method: "HEAD" });
  const len = Number(res.headers.get("content-length"));
  return res.ok && len > 0 ? len : null;
}

async function backfill(table: "garment_images" | "post_images") {
  const { data, error } = await supabase
    .from(table)
    .select("id, cf_image_id")
    .eq("bytes", 0);
  if (error) throw new Error(`${table}: ${error.message}`);
  let ok = 0;
  for (const row of data ?? []) {
    if (isHttp(row.cf_image_id)) continue;
    const bytes = await sizeOf(row.cf_image_id);
    if (!bytes) {
      console.warn(`  ${table} ${row.id}: sin tamaño para ${row.cf_image_id}`);
      continue;
    }
    const { error: upErr } = await supabase.from(table).update({ bytes }).eq("id", row.id);
    if (upErr) console.warn(`  ${table} ${row.id}: ${upErr.message}`);
    else ok++;
  }
  console.log(`${table}: ${ok} de ${data?.length ?? 0} actualizadas`);
}

async function backfillCovers() {
  const { data, error } = await supabase
    .from("brands")
    .select("id, logo_url")
    .eq("logo_bytes", 0)
    .not("logo_url", "is", null);
  if (error) throw new Error(`brands: ${error.message}`);
  let ok = 0;
  for (const b of data ?? []) {
    if (!b.logo_url || isHttp(b.logo_url)) continue;
    const bytes = await sizeOf(b.logo_url);
    if (!bytes) continue;
    const { error: upErr } = await supabase.from("brands").update({ logo_bytes: bytes }).eq("id", b.id);
    if (!upErr) ok++;
  }
  console.log(`brands (portadas): ${ok} de ${data?.length ?? 0} actualizadas`);
}

async function main() {
  // Sin variables en línea, .env.local apunta al Supabase local: decirlo evita creer que corrió en la nube.
  console.log(`Supabase: ${url}${url!.includes("127.0.0.1") || url!.includes("localhost") ? " (LOCAL)" : ""}`);
  await backfill("garment_images");
  await backfill("post_images");
  await backfillCovers();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
