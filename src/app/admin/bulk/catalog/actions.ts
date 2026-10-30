"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_CSV_BYTES,
  advanceRun,
  createRun,
  discardRun,
  type AdvanceResult,
  type CatalogComparison,
  type StartResult,
} from "@/lib/catalog-runs";
import type { Json } from "@/lib/database.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN; // NaN → la validación de createRun lo rechaza
}

// Crea una corrida de lectura de catálogo. No lee productos todavía (salvo el CSV) ni crea prendas.
export async function startCatalogRun(formData: FormData): Promise<StartResult> {
  const profile = await requireStaff();

  const brandId = String(formData.get("brand_id") ?? "");
  if (!UUID.test(brandId)) return { ok: false, error: "Elige la marca a la que pertenece el catálogo." };

  let csv: { name: string; text: string } | null = null;
  const file = formData.get("csv");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV_BYTES) return { ok: false, error: "El CSV pesa más de 10 MB." };
    csv = { name: file.name, text: await file.text() };
  }

  const url = String(formData.get("url") ?? "").trim() || null;
  const result = await createRun({
    userId: profile.id,
    brandId,
    consent: formData.get("consent") === "on",
    url,
    csv,
    contact: String(formData.get("contact") ?? "").trim() || null,
    max: intOrNull(formData.get("max")),
    skipPhotos: formData.get("skip_photos") === "on",
    pauseMs: intOrNull(formData.get("pause_ms")),
  });
  if (result.ok) revalidatePath("/admin/bulk");
  return result;
}

// Una tanda de trabajo (~40 s como máximo). El navegador la repite hasta `done`.
export async function advanceCatalogRun(runId: string): Promise<AdvanceResult> {
  await requireStaff();
  if (!UUID.test(runId)) return { ok: false, error: "La corrida no es válida.", retryable: false };
  const res = await advanceRun(runId);
  if (res.ok && res.done) revalidatePath("/admin/bulk");
  return res;
}

// Completa el registro de una importación con lo que pasó con las fotos (FR-015). Solo si esa corrida ya
// tiene la importación registrada (el Excel traía la hoja «Origen»).
export async function reportPhotoImport(
  runId: string,
  stats: { photos_matched: number; photos_unmatched: number; garments_without_photo: number },
): Promise<{ ok: boolean; error?: string }> {
  await requireStaff();
  if (!UUID.test(runId)) return { ok: false, error: "La corrida no es válida." };
  const n = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);
  const supabase = await createClient();
  const { data: run } = await supabase
    .from("catalog_runs")
    .select("imported_at, import_stats")
    .eq("id", runId)
    .maybeSingle();
  if (!run?.imported_at) return { ok: false, error: "Esta corrida no tiene una importación registrada." };
  const prev = (run.import_stats ?? {}) as Record<string, number>;
  const { error } = await supabase
    .from("catalog_runs")
    .update({
      import_stats: {
        ...prev,
        photos_matched: (prev.photos_matched ?? 0) + n(stats.photos_matched),
        photos_unmatched: (prev.photos_unmatched ?? 0) + n(stats.photos_unmatched),
        garments_without_photo: (prev.garments_without_photo ?? 0) + n(stats.garments_without_photo),
      },
    })
    .eq("id", runId);
  revalidatePath("/admin/bulk");
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Descarta una corrida (borra sus archivos temporales). Sirve para "Empezar de nuevo".
export async function discardCatalogRun(runId: string): Promise<{ ok: boolean; error?: string }> {
  await requireStaff();
  if (!UUID.test(runId)) return { ok: false, error: "La corrida no es válida." };
  const res = await discardRun(runId);
  revalidatePath("/admin/bulk");
  return res;
}

// ───────────────────────────── comparación: archivar / volver a publicar ─────────────────────────────
export type ComparisonActionResult =
  | { ok: true; changed: number }
  | { ok: false; error: string; needsExtraConfirm?: boolean };

type RunActions = { type: "archive" | "republish"; at: string; by: string; garment_ids: string[] }[];

async function loadComparisonRun(runId: string) {
  const supabase = await createClient();
  const { data: run } = await supabase
    .from("catalog_runs")
    .select("id, phase, is_complete, comparison, actions, finished_at")
    .eq("id", runId)
    .maybeSingle();
  const comparison = (run?.comparison as unknown as CatalogComparison | null) ?? null;
  return { supabase, run, comparison };
}

// Archiva las prendas que el staff eligió del grupo «ya no aparecen». Nada se archiva solo (SC-008).
export async function archiveMissingAction(
  runId: string,
  garmentIds: string[],
  confirmHighRatio = false,
): Promise<ComparisonActionResult> {
  const profile = await requireStaff();
  if (!UUID.test(runId) || !garmentIds.every((id) => UUID.test(id)) || !garmentIds.length)
    return { ok: false, error: "Elige al menos una prenda." };
  const { supabase, run, comparison } = await loadComparisonRun(runId);
  if (!run || run.phase !== "done" || !run.is_complete || !comparison)
    return { ok: false, error: "Esta corrida no tiene una comparación disponible." };

  const allowed = new Set(comparison.ya_no.map((g) => g.garment_id));
  if (!garmentIds.every((id) => allowed.has(id)))
    return { ok: false, error: "Alguna prenda ya no está en la lista de «ya no aparecen». Recarga la página." };
  if (comparison.high_missing_ratio && !confirmHighRatio)
    return {
      ok: false,
      needsExtraConfirm: true,
      error: "Más del 30 % del catálogo no apareció: podría ser un fallo de lectura. Confirma de nuevo para continuar.",
    };

  const { data: changed, error } = await supabase
    .from("garments")
    .update({ status: "archived", discontinued_at: new Date().toISOString() })
    .in("id", garmentIds)
    .in("status", ["pending", "published"])
    .select("id");
  if (error) return { ok: false, error: error.message };
  const ids = (changed ?? []).map((g) => g.id);

  const actions = (Array.isArray(run.actions) ? run.actions : []) as unknown as RunActions;
  await supabase
    .from("catalog_runs")
    .update({
      comparison: { ...comparison, ya_no: comparison.ya_no.filter((g) => !ids.includes(g.garment_id)) } as unknown as Json,
      actions: [...actions, { type: "archive", at: new Date().toISOString(), by: profile.id, garment_ids: ids }] as unknown as Json,
    })
    .eq("id", runId);
  revalidatePath("/admin/bulk");
  revalidatePath("/feed");
  return { ok: true, changed: ids.length };
}

// Vuelve a publicar prendas archivadas por la comparación que reaparecieron en la tienda. Con foto pasan a
// `published`; sin foto, a `pending` (como cualquier prenda sin foto).
export async function republishReappearedAction(runId: string, garmentIds: string[]): Promise<ComparisonActionResult> {
  const profile = await requireStaff();
  if (!UUID.test(runId) || !garmentIds.every((id) => UUID.test(id)) || !garmentIds.length)
    return { ok: false, error: "Elige al menos una prenda." };
  const { supabase, run, comparison } = await loadComparisonRun(runId);
  if (!run || run.phase !== "done" || !run.is_complete || !comparison)
    return { ok: false, error: "Esta corrida no tiene una comparación disponible." };

  const allowed = new Set(comparison.reaparecen.map((g) => g.garment_id));
  if (!garmentIds.every((id) => allowed.has(id)))
    return { ok: false, error: "Alguna prenda ya no está en la lista de «reaparecen». Recarga la página." };

  const { data: imgs } = await supabase.from("garment_images").select("garment_id").in("garment_id", garmentIds);
  const withPhoto = new Set((imgs ?? []).map((i) => i.garment_id));
  const now = new Date().toISOString();
  const seen = run.finished_at ?? now;
  const toPublish = garmentIds.filter((id) => withPhoto.has(id));
  const toPending = garmentIds.filter((id) => !withPhoto.has(id));
  const done: string[] = [];
  for (const [ids, patch] of [
    [toPublish, { status: "published" as const, published_at: now }],
    [toPending, { status: "pending" as const }],
  ] as const) {
    if (!ids.length) continue;
    const { data, error } = await supabase
      .from("garments")
      .update({ ...patch, discontinued_at: null, last_seen_at: seen })
      .in("id", ids)
      .eq("status", "archived")
      .select("id");
    if (error) return { ok: false, error: error.message };
    done.push(...(data ?? []).map((g) => g.id));
  }

  const actions = (Array.isArray(run.actions) ? run.actions : []) as unknown as RunActions;
  await supabase
    .from("catalog_runs")
    .update({
      comparison: { ...comparison, reaparecen: comparison.reaparecen.filter((g) => !done.includes(g.garment_id)) } as unknown as Json,
      actions: [...actions, { type: "republish", at: now, by: profile.id, garment_ids: done }] as unknown as Json,
    })
    .eq("id", runId);
  revalidatePath("/admin/bulk");
  revalidatePath("/feed");
  return { ok: true, changed: done.length };
}
