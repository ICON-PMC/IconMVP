"use server";

import { revalidatePath } from "next/cache";
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
      description: string | null;
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
        description: get(row, "descripcion") || null,
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

export type ActionResult = { ok: boolean; error?: string };

// Sube la foto de una prenda pendiente y la pasa a published. Devuelve resultado
// (no redirige) para poder llamarla en lote desde el cliente ("subir todas").
export async function uploadGarmentImageAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireStaff();
  const garmentId = String(formData.get("garment_id") ?? "");
  if (!garmentId) return { ok: false, error: "Falta la prenda" };

  const supabase = await createClient();
  let key: string | null;
  try {
    key = await uploadImageField(formData, `garments/${garmentId}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al subir";
    console.error("[uploadGarmentImage] resize/R2 falló:", msg);
    return { ok: false, error: msg };
  }
  if (!key) return { ok: false, error: "Selecciona una imagen" };

  const { error: imgErr } = await supabase
    .from("garment_images")
    .insert({ garment_id: garmentId, cf_image_id: key, position: 0 });
  if (imgErr) {
    console.error("[uploadGarmentImage] insert garment_images falló:", imgErr.message);
    return { ok: false, error: imgErr.message };
  }

  await supabase
    .from("garments")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", garmentId);

  revalidatePath("/admin/bulk");
  revalidatePath("/feed");
  return { ok: true };
}

// Borra una prenda (cascade limpia imágenes/tags/sizes/post_items).
export async function deleteGarmentAction(
  garmentId: string,
): Promise<ActionResult> {
  await requireStaff();
  if (!garmentId) return { ok: false, error: "Falta la prenda" };

  const supabase = await createClient();
  const { error } = await supabase.from("garments").delete().eq("id", garmentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/bulk");
  revalidatePath("/feed");
  return { ok: true };
}

// Borra todas las prendas pendientes sin foto (las recién importadas). Útil para
// limpiar duplicados al reimportar la misma plantilla.
export async function deleteAllPendingAction(): Promise<{
  ok: boolean;
  deleted: number;
  error?: string;
}> {
  await requireStaff();
  const supabase = await createClient();

  const { data: pend } = await supabase
    .from("garments")
    .select("id")
    .eq("status", "pending")
    .limit(1000);
  const ids = (pend ?? []).map((g) => g.id);
  if (!ids.length) return { ok: true, deleted: 0 };

  const { data: imgs } = await supabase
    .from("garment_images")
    .select("garment_id")
    .in("garment_id", ids);
  const withImg = new Set((imgs ?? []).map((i) => i.garment_id));
  const toDelete = ids.filter((id) => !withImg.has(id));
  if (!toDelete.length) return { ok: true, deleted: 0 };

  const { error } = await supabase.from("garments").delete().in("id", toDelete);
  if (error) return { ok: false, deleted: 0, error: error.message };

  revalidatePath("/admin/bulk");
  revalidatePath("/feed");
  return { ok: true, deleted: toDelete.length };
}
