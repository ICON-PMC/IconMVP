/**
 * Guarda ancho y alto de las fotos ya subidas (spec 007: el feed usa la proporción real de cada foto).
 *
 * Uso:  npm run db:image-dims                    (fotos sin medidas en la base de .env.local)
 *       npm run db:image-dims -- --sql out.sql   (además escribe los UPDATE por clave, para otra base)
 *       npm run db:image-dims -- --keys k.txt --sql out.sql   (solo mide las claves del archivo, sin tocar la base)
 * Necesita las variables de R2; para la base, NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

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

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

type Row = { table: "garment_images" | "post_images"; id: string | null; key: string };

async function main() {
  const { default: sharp } = await import("sharp");
  const { getFromR2 } = await import("../src/lib/r2");
  const sqlOut = arg("sql");
  const keysFile = arg("keys");
  if (sqlOut) writeFileSync(sqlOut, "-- Medidas de fotos (scripts/backfill-image-dims.ts)\n");

  let rows: Row[];
  let admin: Awaited<ReturnType<typeof import("../src/lib/supabase/admin")["createAdminClient"]>> | null = null;
  if (keysFile) {
    rows = readFileSync(keysFile, "utf8")
      .split("\n")
      .map((k) => k.trim())
      .filter((k) => k.startsWith("garments/") || k.startsWith("posts/"))
      .map((key) => ({ table: key.startsWith("posts/") ? "post_images" : "garment_images", id: null, key }));
  } else {
    const { createAdminClient } = await import("../src/lib/supabase/admin");
    admin = createAdminClient();
    const [g, p] = await Promise.all([
      admin.from("garment_images").select("id, cf_image_id").is("width", null),
      admin.from("post_images").select("id, cf_image_id").is("width", null),
    ]);
    rows = [
      ...(g.data ?? []).map((r) => ({ table: "garment_images" as const, id: r.id, key: r.cf_image_id })),
      ...(p.data ?? []).map((r) => ({ table: "post_images" as const, id: r.id, key: r.cf_image_id })),
    ];
  }

  let done = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      if (/^https?:\/\//.test(r.key)) throw new Error("no es una clave de R2");
      const res = await getFromR2(r.key);
      if (!res) throw new Error("no existe en R2");
      const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
      if (!meta.width || !meta.height) throw new Error("sin medidas");
      if (admin && r.id) {
        const { error } = await admin.from(r.table).update({ width: meta.width, height: meta.height }).eq("id", r.id);
        if (error) throw new Error(error.message);
      }
      if (sqlOut)
        appendFileSync(
          sqlOut,
          `update ${r.table} set width = ${meta.width}, height = ${meta.height} where cf_image_id = '${r.key.replace(/'/g, "''")}' and width is null;\n`,
        );
      done++;
      console.log(`✓ ${r.key} ${meta.width}×${meta.height}`);
    } catch (e) {
      failed++;
      console.log(`✗ ${r.key}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\nMedidas: ${done} · Fallidas: ${failed}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
