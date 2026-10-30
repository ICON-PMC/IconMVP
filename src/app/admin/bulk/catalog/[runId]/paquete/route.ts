import { Zip, ZipPassThrough } from "fflate";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getFromR2 } from "@/lib/r2";
import { slug } from "@/lib/catalog/infer";
import type { Json } from "@/lib/database.types";

// Armar y enviar un paquete de decenas de MB puede tardar; el ZIP va en streaming (una foto a la vez).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

type PackageKeys = { xlsx?: string | null; origen?: string | null; photos?: string[] };

// GET /admin/bulk/catalog/[runId]/paquete → <marca>-catalogo.zip con catalogo.xlsx, origen.json, fotos/ y LEEME.txt
export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  await requireStaff();
  const { runId } = await params;
  if (!UUID.test(runId)) return text("Corrida no encontrada.", 404);

  const supabase = await createClient();
  const { data: run } = await supabase
    .from("catalog_runs")
    .select("id, brand_id, phase, expires_at, package_keys")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return text("Corrida no encontrada.", 404);
  if (run.phase !== "done") return text("El paquete todavía no está listo.", 409);
  if (new Date(run.expires_at).getTime() < Date.now())
    return text("El paquete venció (se conserva 7 días). Genera uno nuevo.", 409);

  const { data: brand } = await supabase.from("brands").select("name").eq("id", run.brand_id).maybeSingle();
  const folder = slug(brand?.name ?? "catalogo");
  const keys = (run.package_keys ?? {}) as Json as PackageKeys;
  const files: { name: string; key: string }[] = [];
  if (keys.xlsx) files.push({ name: `${folder}/catalogo.xlsx`, key: keys.xlsx });
  if (keys.origen) files.push({ name: `${folder}/origen.json`, key: keys.origen });
  for (const key of keys.photos ?? []) files.push({ name: `${folder}/fotos/${key.split("/").pop()}`, key });

  const enc = new TextEncoder();
  const skipped: string[] = [];
  let index = 0;
  let zip: Zip;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err);
        if (chunk.length) controller.enqueue(chunk);
        if (final) controller.close();
      });
    },
    async pull() {
      if (index < files.length) {
        const { name, key } = files[index++];
        try {
          const res = await getFromR2(key);
          if (!res) throw new Error("no existe");
          const entry = new ZipPassThrough(name); // sin recomprimir: las fotos ya vienen comprimidas
          zip.add(entry);
          entry.push(new Uint8Array(await res.arrayBuffer()), true);
        } catch (e) {
          console.error(`[paquete] no se pudo leer ${key}:`, e instanceof Error ? e.message : e);
          skipped.push(name);
        }
      } else if (index === files.length) {
        index++;
        const lines = [
          "Paquete de catálogo generado por Icon.",
          "",
          "1. Abre catalogo.xlsx y revisa cada fila. Las columnas de categoría, estilo, ocasión y clima son",
          "   SUGERENCIAS automáticas: corrígelas antes de importar. La columna «revisar» lista lo pendiente.",
          "2. Borra las filas que no quieras importar.",
          "3. En el panel de administración (Carga masiva), sube catalogo.xlsx y la carpeta fotos/ de una sola vez.",
          "   Las fotos se emparejan con las prendas por la columna «foto».",
          ...(skipped.length
            ? ["", "No se pudieron incluir estos archivos (genera el paquete de nuevo si los necesitas):", ...skipped.map((s) => `- ${s}`)]
            : []),
          "",
        ];
        const readme = new ZipPassThrough(`${folder}/LEEME.txt`);
        zip.add(readme);
        readme.push(enc.encode(lines.join("\n")), true);
      } else {
        index++;
        zip.end();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${folder}-catalogo.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
