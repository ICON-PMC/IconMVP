/**
 * Genera las variantes de 320 y 640 px (spec 006) de las imágenes que aún no las tienen.
 * Se puede interrumpir y volver a correr: sigue con lo pendiente.
 *
 * Uso:  npm run db:image-variants                 (todo lo pendiente)
 *       npm run db:image-variants -- --limit 50   (máximo 50 imágenes)
 *       npm run db:image-variants -- --dry-run    (solo cuenta lo pendiente)
 * Lee .env.local. Para la nube:
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run db:image-variants
 * Necesita además las variables de R2 (R2_S3_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).
 */
import { readFileSync } from "node:fs";

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

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  // Import dinámico: los módulos leen las variables de entorno al usarse, ya cargadas arriba.
  const { processPendingVariants } = await import("../src/lib/image-variants");
  const limit = Number(arg("limit") ?? Infinity);
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    const { remaining } = await processPendingVariants(0);
    console.log(`Pendientes: ${remaining}`);
    return;
  }

  let done = 0;
  let failed = 0;
  let remaining = 0;
  const failedIds = new Set<string>();
  while (done + failed < limit) {
    const batch = Math.min(25, limit - done - failed);
    const r = await processPendingVariants(batch, (item, ok, error) => {
      if (ok) console.log(`✓ ${item.table} ${item.key}`);
      else {
        failedIds.add(item.id);
        console.log(`✗ ${item.table} ${item.key}: ${error}`);
      }
    });
    done += r.done;
    failed += r.failed;
    remaining = r.remaining;
    // Sin avance (todo lo que queda falla siempre): parar para no repetir en bucle.
    if (r.done === 0 || remaining === 0) break;
  }
  console.log(`\nHechas: ${done} · Fallidas: ${failed} · Pendientes: ${remaining}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
