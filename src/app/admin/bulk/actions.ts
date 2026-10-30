"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { uploadImageField } from "@/lib/upload";
import { normalizeUrl } from "@/lib/links";
import { MAX_GARMENT_TAGS_PER_TYPE } from "@/lib/tags";
import { deleteFromR2 } from "@/lib/r2";
import { imageKeysFor } from "@/lib/image-keys";
import { productKey } from "@/lib/catalog/product-key";
import { StorageQuotaError } from "@/lib/storage-quota";

export type RowResult = {
  line: number;
  title: string;
  ok: boolean;
  message?: string;
  // "exists": la prenda ya está en Icon (misma marca y enlace de compra); no es un error (FR-014).
  skipped?: "exists";
};
export type ImportResult = {
  created: number;
  skippedExisting: number;
  results: RowResult[];
  // Columna `foto` del Excel ↔ prenda creada: con esto el cliente empareja la carpeta de fotos.
  photos: { line: number; file: string; garmentId: string }[];
  // Corrida de lectura de catálogo de la que viene el Excel (hoja oculta «Origen»), si la trae.
  runId?: string;
  error?: string;
} | null;

const failImport = (error: string, results: RowResult[] = []): NonNullable<ImportResult> => ({
  created: 0,
  skippedExisting: 0,
  results,
  photos: [],
  error,
});

// Nombre de archivo de la columna `foto`: solo el nombre, sin ruta.
const photoFileName = (raw: string) => raw.trim().split(/[\\/]/).pop()?.trim() ?? "";

// Claves "marca|handle" de las prendas ya existentes de esas marcas (todos los estados). Pagina de a
// 1000 porque PostgREST limita las respuestas.
async function existingProductKeys(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandIds: string[],
): Promise<Set<string>> {
  const keys = new Set<string>();
  if (!brandIds.length) return keys;
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("garments")
      .select("brand_id, product_url")
      .in("brand_id", brandIds)
      .not("product_url", "is", null)
      .order("id")
      .range(from, from + 999);
    for (const g of data ?? []) {
      const k = productKey(g.product_url);
      if (k) keys.add(`${g.brand_id}|${k}`);
    }
    if ((data?.length ?? 0) < 1000) break;
  }
  return keys;
}

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
  if (!(file instanceof File) || file.size === 0) return failImport("Sube un archivo .xlsx");

  const wb = new ExcelJS.Workbook();
  try {
    // Cast al tipo exacto que espera exceljs (evita el choque Buffer<ArrayBufferLike> de @types/node).
    const buf = Buffer.from(await file.arrayBuffer());
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    return failImport("No se pudo leer el archivo. ¿Es un .xlsx válido?");
  }
  const ws = wb.getWorksheet("Prendas") ?? wb.worksheets[0];
  if (!ws) return failImport("El archivo no tiene hojas.");

  // Mapa de columnas por encabezado (fila 1) → robusto a reordenar columnas.
  const headers: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => {
    const key = norm(cellText(cell)).replace(/\s+/g, "_");
    if (key) headers[key] = col;
  });
  if (!headers["marca"] || !headers["titulo"])
    return failImport("Faltan las columnas obligatorias 'marca' y 'titulo'.");

  const supabase = await createClient();
  const [brandsRes, tagsRes, sizesRes] = await Promise.all([
    supabase.from("brands").select("id, name, slug"),
    supabase.from("tags").select("id, name, slug, type"),
    supabase.from("sizes").select("id, label, aliases"),
  ]);

  const brandMap = new Map<string, string>();
  for (const b of brandsRes.data ?? []) {
    brandMap.set(norm(b.name), b.id);
    brandMap.set(norm(b.slug), b.id);
  }
  // Un mapa por tipo de tag: nombre o slug normalizado -> id.
  const tagMaps = {
    category: new Map<string, string>(),
    style: new Map<string, string>(),
    occasion: new Map<string, string>(),
    temperature: new Map<string, string>(),
  };
  for (const t of tagsRes.data ?? []) {
    tagMaps[t.type].set(norm(t.name), t.id);
    tagMaps[t.type].set(norm(t.slug), t.id);
  }
  const catMap = tagMaps.category;
  // Columnas de estilo/ocasión/clima: varios valores separados por coma (hasta 3 por tipo).
  const TAG_COLUMNS = [
    { col: "estilo", type: "style", label: "estilo" },
    { col: "ocasion", type: "occasion", label: "ocasión" },
    { col: "clima", type: "temperature", label: "clima" },
  ] as const;
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
    tagIds: string[];
    sizeIds: string[];
    notes: string[];
    key: string | null; // "marca|handle" para la deduplicación
    foto: string; // nombre de archivo de la columna `foto`
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
    const urlRaw = get(row, "url_producto");
    const product_url = normalizeUrl(urlRaw);
    if (urlRaw && !product_url) notes.push(`link de compra inválido "${urlRaw}" (omitido)`);
    const precioRaw = get(row, "precio_cop").replace(/[^\d]/g, "");
    const price_cop = precioRaw ? Number(precioRaw) : null;

    const catRaw = get(row, "categoria");
    let categoryId: string | null = null;
    if (catRaw) {
      categoryId = catMap.get(norm(catRaw)) ?? null;
      if (!categoryId) notes.push(`categoría desconocida "${catRaw}" (omitida)`);
    }

    const tagIds: string[] = [];
    for (const { col, type, label } of TAG_COLUMNS) {
      const raw = get(row, col);
      if (!raw) continue;
      const ids: string[] = [];
      for (const v of raw.split(/[,;/]/).map((x) => x.trim()).filter(Boolean)) {
        const id = tagMaps[type].get(norm(v));
        if (!id) notes.push(`${label} desconocido "${v}" (omitido)`);
        else if (ids.length >= MAX_GARMENT_TAGS_PER_TYPE)
          notes.push(`más de ${MAX_GARMENT_TAGS_PER_TYPE} de ${label}: "${v}" (omitido)`);
        else if (!ids.includes(id)) ids.push(id);
      }
      tagIds.push(...ids);
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

    const urlKey = productKey(product_url);
    if (!urlKey) notes.push("sin enlace de compra: no se puede comprobar si ya existe");

    pending.push({
      line: r,
      insert: {
        brand_id: brandId,
        title: titulo,
        description: get(row, "descripcion") || null,
        price_cop,
        product_url,
        color: get(row, "color") || null,
        fabric: get(row, "tela") || null,
        status: "pending",
        source: "team",
        created_by_user_id: profile.id,
      },
      categoryId,
      tagIds,
      sizeIds,
      notes,
      key: urlKey ? `${brandId}|${urlKey}` : null,
      foto: photoFileName(get(row, "foto")),
    });
  }

  // Deduplicación (FR-014): misma marca + mismo enlace de compra que una prenda existente o que otra fila
  // del mismo archivo. Se comprueba justo antes de insertar para acortar la ventana de dos importaciones
  // simultáneas de la misma marca (un duplicado residual es un riesgo aceptado).
  let skippedExisting = 0;
  if (pending.some((p) => p.key)) {
    const brandIds = [...new Set(pending.filter((p) => p.key).map((p) => p.insert.brand_id))];
    const taken = await existingProductKeys(supabase, brandIds);
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      if (!p.key) continue;
      if (taken.has(p.key)) {
        results.push({
          line: p.line,
          title: p.insert.title,
          ok: false,
          skipped: "exists",
          message: "ya existe (misma marca y enlace de compra)",
        });
        skippedExisting++;
        pending.splice(i, 1);
      }
    }
    // Dentro del archivo: la primera fila gana y las repetidas se omiten.
    const seen = new Set<string>();
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      if (!p.key) continue;
      if (seen.has(p.key)) {
        results.push({
          line: p.line,
          title: p.insert.title,
          ok: false,
          skipped: "exists",
          message: "repetida en este archivo (misma marca y enlace de compra)",
        });
        skippedExisting++;
        pending.splice(i--, 1);
      } else seen.add(p.key);
    }
  }

  if (!pending.length) {
    results.sort((a, b) => a.line - b.line);
    // Aunque no se cree nada, si el Excel viene de una corrida se anota cuántas ya existían.
    const runId = skippedExisting ? await linkImportToRun(supabase, wb, profile.id, [], skippedExisting) : undefined;
    return {
      created: 0,
      skippedExisting,
      results,
      photos: [],
      runId,
      error: results.length ? undefined : "No se encontraron filas con datos.",
    };
  }

  // Inserta todas las prendas en un solo INSERT; RETURNING preserva el orden del array.
  const { data: inserted, error } = await supabase
    .from("garments")
    .insert(pending.map((p) => p.insert))
    .select("id");
  if (error || !inserted || inserted.length !== pending.length)
    return failImport(`Error al insertar prendas: ${error?.message ?? "respuesta inesperada"}`, results);

  const tagRows: { garment_id: string; tag_id: string }[] = [];
  const sizeRows: { garment_id: string; size_id: string }[] = [];
  const photos: { line: number; file: string; garmentId: string }[] = [];
  pending.forEach((p, i) => {
    const id = inserted[i].id;
    if (p.foto) photos.push({ line: p.line, file: p.foto, garmentId: id });
    if (p.categoryId) tagRows.push({ garment_id: id, tag_id: p.categoryId });
    for (const tid of p.tagIds) tagRows.push({ garment_id: id, tag_id: tid });
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

  // Si el Excel viene de una corrida del panel (hoja oculta «Origen»), se registra la importación en
  // esa corrida (procedencia, FR-015) y se marca la fecha de lectura de las prendas creadas (FR-020).
  const runId = await linkImportToRun(
    supabase,
    wb,
    profile.id,
    pending.map((p, i) => ({ id: inserted[i].id, brandId: p.insert.brand_id })),
    skippedExisting,
  );

  revalidatePath("/admin/bulk");
  return { created: pending.length, skippedExisting, results, photos, runId };
}

// Lee la hoja oculta «Origen (no editar)» del Excel y, si la corrida existe y es de la marca de las
// prendas creadas, anota la importación en ella. Un Excel sin esa hoja (o ajeno) no deja registro.
async function linkImportToRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  wb: ExcelJS.Workbook,
  userId: string,
  created: { id: string; brandId: string }[],
  skippedExisting: number,
): Promise<string | undefined> {
  const sheet = wb.getWorksheet("Origen (no editar)");
  if (!sheet) return undefined;
  const runId = cellText(sheet.getRow(1).getCell(2));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) return undefined;

  const { data: run } = await supabase
    .from("catalog_runs")
    .select("id, brand_id, phase, source_kind, is_complete, finished_at, imported_at, import_stats")
    .eq("id", runId)
    .maybeSingle();
  if (!run || run.phase === "discarded") return undefined;
  const mine = created.filter((c) => c.brandId === run.brand_id);
  if (!mine.length && !skippedExisting) return undefined;

  const prev = (run.import_stats ?? {}) as Record<string, number>;
  await supabase
    .from("catalog_runs")
    .update({
      imported_at: run.imported_at ?? new Date().toISOString(),
      imported_by: userId,
      import_stats: {
        ...prev,
        created: (prev.created ?? 0) + mine.length,
        skipped_existing: (prev.skipped_existing ?? 0) + skippedExisting,
      },
    })
    .eq("id", run.id);

  // Las prendas creadas desde una lectura completa de la tienda ya se vieron ahí: no deben figurar
  // «sin verificar». Con CSV o lectura parcial se dejan en null.
  if (run.source_kind === "shop" && run.is_complete && run.finished_at && mine.length)
    await supabase
      .from("garments")
      .update({ last_seen_at: run.finished_at })
      .in("id", mine.map((m) => m.id));
  return run.id;
}

export type ActionResult = { ok: boolean; error?: string; code?: "quota" };

// Sube la foto de una prenda pendiente y la pasa a published. Devuelve resultado
// (no redirige) para poder llamarla en lote desde el cliente ("subir todas").
export async function uploadGarmentImageAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireStaff();
  const garmentId = String(formData.get("garment_id") ?? "");
  if (!garmentId) return { ok: false, error: "Falta la prenda" };

  const supabase = await createClient();

  // strict_quota=1 (carga masiva): respeta los 300 MB de la marca. El brand_id se lee aquí, en el
  // servidor, de la prenda: nunca viene del cliente.
  let enforceQuotaFor: string | undefined;
  if (formData.get("strict_quota") === "1") {
    const { data: g } = await supabase.from("garments").select("brand_id").eq("id", garmentId).maybeSingle();
    if (!g) return { ok: false, error: "La prenda no existe." };
    enforceQuotaFor = g.brand_id;
  }

  let img: Awaited<ReturnType<typeof uploadImageField>>;
  try {
    img = await uploadImageField(formData, `garments/${garmentId}`, "image", { enforceQuotaFor });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al subir";
    if (e instanceof StorageQuotaError) return { ok: false, code: "quota", error: msg };
    console.error("[uploadGarmentImage] resize/R2 falló:", msg);
    return { ok: false, error: msg };
  }
  if (!img) return { ok: false, error: "Selecciona una imagen" };

  const { error: imgErr } = await supabase
    .from("garment_images")
    .insert({ garment_id: garmentId, cf_image_id: img.key, bytes: img.bytes, position: 0 });
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
  const keys = await imageKeysFor(supabase, { garmentIds: [garmentId] });
  const { error } = await supabase.from("garments").delete().eq("id", garmentId);
  if (error) return { ok: false, error: error.message };
  await deleteFromR2(keys);

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
