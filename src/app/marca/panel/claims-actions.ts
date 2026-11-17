"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireBrandOwner } from "@/lib/auth";
import { isUuid } from "@/lib/look-rules";

// Acciones de la bandeja de menciones (spec 010, contracts §2). Las reglas viven en la base: cada
// función valida que quien llama administra la marca (o es del equipo actuando como ella).

type Result = { ok: true } | { ok: false; error: string };

async function brandCtx() {
  const { brand } = await requireBrandOwner();
  if (!brand || brand.status !== "active") return null;
  return brand;
}

function done(postIds: string[] = []): Result {
  revalidatePath("/marca/panel");
  for (const id of postIds) revalidatePath(`/post/${id}`);
  return { ok: true };
}

const fail = (e: { message: string }): Result => ({ ok: false, error: e.message });

export async function reviewTag(postId: string, accept: boolean, note?: string): Promise<Result> {
  const brand = await brandCtx();
  if (!brand) return { ok: false, error: "Tu marca debe estar aprobada." };
  if (!isUuid(postId)) return { ok: false, error: "Look no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_post_tag", {
    p_post_id: postId,
    p_brand_id: brand.id,
    p_accept: accept,
    p_note: note?.trim() || null,
  });
  return error ? fail(error) : done([postId]);
}

export async function linkProposed(proposedId: string, garmentId: string): Promise<Result> {
  const brand = await brandCtx();
  if (!brand) return { ok: false, error: "Tu marca debe estar aprobada." };
  if (!isUuid(proposedId) || !isUuid(garmentId)) return { ok: false, error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_proposed_garment", { p_proposed_id: proposedId, p_garment_id: garmentId });
  revalidatePath("/feed");
  return error ? fail(error) : done();
}

/** Crea la prenda pendiente y abre su editor en el catálogo. */
export async function convertProposed(proposedId: string): Promise<Result> {
  const brand = await brandCtx();
  if (!brand) return { ok: false, error: "Tu marca debe estar aprobada." };
  if (!isUuid(proposedId)) return { ok: false, error: "Prenda no válida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_proposed_garment_conversion", { p_proposed_id: proposedId });
  if (error) return fail(error);
  revalidatePath("/marca/panel");
  redirect(`/marca/panel?tab=catalogo&editar=${data}`);
}

export async function disownProposed(proposedId: string): Promise<Result> {
  const brand = await brandCtx();
  if (!brand) return { ok: false, error: "Tu marca debe estar aprobada." };
  if (!isUuid(proposedId)) return { ok: false, error: "Prenda no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("disown_proposed_garment", { p_proposed_id: proposedId });
  return error ? fail(error) : done();
}

export async function requestProposed(proposedId: string): Promise<Result> {
  const brand = await brandCtx();
  if (!brand) return { ok: false, error: "Tu marca debe estar aprobada." };
  if (!isUuid(proposedId)) return { ok: false, error: "Prenda no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_proposed_garment", { p_proposed_id: proposedId, p_brand_id: brand.id });
  return error ? fail(error) : done();
}
