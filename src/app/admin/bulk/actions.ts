"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { uploadImageField } from "@/lib/upload";

export type RowResult = {
  line: number;
  title: string;
  ok: boolean;
  message?: string;
};
export type ImportResult = {
  created: number;
  results: RowResult[];
  error?: string;
} | null;

// Normaliza para comparar (sin acentos, minúsculas, sin espacios sobrantes).
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

// Extrae texto plano de una celda de exceljs (string, número, fórmula, hyperlink, richText).
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as {
      text?: unknown;
      result?: unknown;
      richText?: { text?: string }[];
    };
    if (typeof o.text === "string") return o.text.trim();
    if (o.result != null) return String(o.result).trim();
    if (Array.isArray(o.richText))
      return o.richText
        .map((t) => t.text ?? "")
        .join("")
        .trim();
  }
  return String(v).trim();
}

export async function importGarments(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const profile = await requireStaff();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { created: 0, results: [], error: "Sube un archivo .xlsx" };

  const wb = new ExcelJS.Workbook();
  try {
    // Cast al tipo exacto que espera exceljs (evita el choque Buffer<ArrayBufferLike> de @types/node).
    const buf = Buffer.from(await file.arrayBuffer());
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    return {
      created: 0,
      results: [],
      error: "No se pudo leer el archivo. ¿Es un .xlsx válido?",
    };
  }
  const ws = wb.getWorksheet("Prendas") ?? wb.worksheets[0];
  if (!ws) return { created: 0, results: [], error: "El archivo no tiene hojas." };

  // Mapa de columnas por encabezado (fila 1) → robusto a reordenar columnas.
  const headers: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => {
    const key = norm(cellText(cell)).replace(/\s+/g, "_");
    if (key) headers[key] = col;
  });
  if (!headers["marca"] || !headers["titulo"])
    return {
      created: 0,
      results: [],
      error: "Faltan las columnas obligatorias 'marca' y 'titulo'.",
    };

  const supabase = await createClient();
  const [brandsRes, catsRes, sizesRes] = await Promise.all([
    supabase.from("brands").select("id, name, slug"),
    supabase.from("tags").select("id, name, slug").eq("type", "category"),
    supabase.from("sizes").select("id, label, aliases"),
  ]);

  const brandMap = new Map<string, string>();
  for (const b of brandsRes.data ?? []) {
    brandMap.set(norm(b.name), b.id);
    brandMap.set(norm(b.slug), b.id);
  }
  const catMap = new Map<string, string>();
  for (const c of catsRes.data ?? []) {
    catMap.set(norm(c.name), c.id);
    catMap.set(norm(c.slug), c.id);
  }
  const sizeMap = new Map<string, string>();
  for (const s of sizesRes.data ?? []) {
    sizeMap.set(norm(s.label), s.id);
    for (const a of s.aliases ?? []) sizeMap.set(norm(a), s.id);
  }

  const get = (row: ExcelJS.Row, key: string) =>
    headers[key] ? cellText(row.getCell(headers[key])) : "";

  type Pending = {
    line: number;
    insert: {
      brand_id: string;
      title: string;
      price_cop: number | null;
      product_url: string | null;
      color: string | null;
      fabric: string | null;
      status: "pending";
      source: "team";
      created_by_user_id: string | null;
    };
    categoryId: string | null;
    sizeIds: string[];
    notes: string[];
  };
  const pending: Pending[] = [];
  const results: RowResult[] = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const marca = get(row, "marca");
    const titulo = get(row, "titulo");
    // Salta filas vacías.
    if (!marca && !titulo && !get(row, "precio_cop") && !get(row, "url_producto"))
      continue;

    if (!titulo) {
      results.push({ line: r, title: "(sin título)", ok: false, message: "Falta el título." });
      continue;
    }
    const brandId = brandMap.get(norm(marca));
    if (!brandId) {
      results.push({ line: r, title: titulo, ok: false, message: `Marca no encontrada: "${marca}".` });
      continue;
    }

    const notes: string[] = [];
    const precioRaw = get(row, "precio_cop").replace(/[^\d]/g, "");
    const price_cop = precioRaw ? Number(precioRaw) : null;

    const catRaw = get(row, "categoria");
    let categoryId: string | null = null;
    if (catRaw) {
      categoryId = catMap.get(norm(catRaw)) ?? null;
      if (!categoryId) notes.push(`categoría desconocida "${catRaw}" (omitida)`);
    }

    const sizeIds: string[] = [];
    const tallasRaw = get(row, "tallas");
    if (tallasRaw) {
      for (const t of tallasRaw
        .split(/[,;/]/)
        .map((x) => x.trim())
        .filter(Boolean)) {
        const sid = sizeMap.get(norm(t));
        if (sid) {
          if (!sizeIds.includes(sid)) sizeIds.push(sid);
        } else {
          notes.push(`talla desconocida "${t}" (omitida)`);
        }
      }
    }

    pending.push({
      line: r,
      insert: {
        brand_id: brandId,
        title: titulo,
        price_cop,
        product_url: get(row, "url_producto") || null,
        color: get(row, "color") || null,
        fabric: get(row, "tela") || null,
        status: "pending",
        source: "team",
        created_by_user_id: profile.id,
      },
      categoryId,
      sizeIds,
      notes,
    });
  }

  if (!pending.length)
    return {
      created: 0,
      results,
      error: results.length ? undefined : "No se encontraron filas con datos.",
    };

  // Inserta todas las prendas en un solo INSERT; RETURNING preserva el orden del array.
  const { data: inserted, error } = await supabase
    .from("garments")
    .insert(pending.map((p) => p.insert))
    .select("id");
  if (error || !inserted || inserted.length !== pending.length)
    return {
      created: 0,
      results,
      error: `Error al insertar prendas: ${error?.message ?? "respuesta inesperada"}`,
    };

  const tagRows: { garment_id: string; tag_id: string }[] = [];
  const sizeRows: { garment_id: string; size_id: string }[] = [];
  pending.forEach((p, i) => {
    const id = inserted[i].id;
    if (p.categoryId) tagRows.push({ garment_id: id, tag_id: p.categoryId });
    for (const sid of p.sizeIds) sizeRows.push({ garment_id: id, size_id: sid });
    results.push({
      line: p.line,
      title: p.insert.title,
      ok: true,
      message: p.notes.join("; ") || undefined,
    });
  });
  if (tagRows.length) await supabase.from("garment_tags").insert(tagRows);
  if (sizeRows.length) await supabase.from("garment_sizes").insert(sizeRows);

  results.sort((a, b) => a.line - b.line);
  revalidatePath("/admin/bulk");
  return { created: pending.length, results };
}

// Sube la foto de una prenda pendiente y la pasa a published.
export async function uploadGarmentImage(formData: FormData) {
  await requireStaff();
  const garmentId = String(formData.get("garment_id") ?? "");
  if (!garmentId) redirect("/admin/bulk?error=Falta la prenda");

  const supabase = await createClient();
  const key = await uploadImageField(formData, `garments/${garmentId}`);
  if (!key) redirect("/admin/bulk?error=Selecciona una imagen");

  await supabase
    .from("garment_images")
    .insert({ garment_id: garmentId, cf_image_id: key, position: 0 });
  await supabase
    .from("garments")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", garmentId);

  revalidatePath("/admin/bulk");
  revalidatePath("/feed");
  redirect("/admin/bulk?ok=publicada");
}
