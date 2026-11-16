"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { userLooksEnabled } from "@/lib/features";
import { uploadImageField } from "@/lib/upload";
import { UserStorageQuotaError } from "@/lib/storage-quota";
import { deleteFromR2 } from "@/lib/r2";
import { imageKeysFor } from "@/lib/image-keys";
import { LOOK_LIMITS, isUuid } from "@/lib/looks";

// Server actions del editor de looks de usuarios (spec 008, contracts §4). Todas exigen sesión y la
// bandera; verifican que el look es de quien llama (además de la RLS) y devuelven los mensajes de la
// base (check_violation) tal cual: ya vienen en español.

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

type Ctx = { supabase: Awaited<ReturnType<typeof createClient>>; me: string };

async function requireLookUser(): Promise<Ctx> {
  if (!userLooksEnabled()) redirect("/feed");
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/crear");
  if (session.profile.role === "brand") redirect("/marca/panel?tab=looks");
  return { supabase: await createClient(), me: session.profile.id };
}

type OwnLook = { id: string; status: "draft" | "published" | "archived"; moderation_locked: boolean };

/** El look es de quien llama y se puede editar. Devuelve el post o un error listo para mostrar. */
async function ownLook(ctx: Ctx, postId: string): Promise<OwnLook | { error: string }> {
  if (!isUuid(postId)) return { error: "No encontramos ese look." };
  const { data } = await ctx.supabase
    .from("posts")
    .select("id, status, moderation_locked, author_type, author_user_id")
    .eq("id", postId)
    .maybeSingle();
  if (!data || data.author_type !== "user" || data.author_user_id !== ctx.me) return { error: "No encontramos ese look." };
  if (data.moderation_locked) return { error: "El equipo de Icon retiró este look y no se puede editar." };
  return data;
}

function dbError(e: { message: string } | null | undefined, fallback = "No pudimos guardar el cambio. Intenta de nuevo."): string {
  if (!e) return fallback;
  // RLS o permisos: no exponer el mensaje técnico.
  if (/row-level security|permission denied/i.test(e.message)) return fallback;
  if (/duplicate key/i.test(e.message)) return "Eso ya está en tu look.";
  return e.message;
}

function touch(postId: string) {
  revalidatePath(`/crear/${postId}`);
}

async function totalTagged(ctx: Ctx, postId: string): Promise<number> {
  const [a, b, c] = await Promise.all([
    ctx.supabase.from("post_items").select("id", { count: "exact", head: true }).eq("post_id", postId),
    ctx.supabase.from("post_proposed_items").select("id", { count: "exact", head: true }).eq("post_id", postId),
    ctx.supabase.from("post_brand_mentions").select("id", { count: "exact", head: true }).eq("post_id", postId),
  ]);
  return (a.count ?? 0) + (b.count ?? 0) + (c.count ?? 0);
}

const NEEDS_ONE_TAG = "Un look publicado necesita al menos una prenda o marca etiquetada. Agrega otra antes de quitar esta.";

// ── fotos ──────────────────────────────────────────────────────────────────────────────────

async function storeImage(ctx: Ctx, postId: string, formData: FormData, position: number) {
  let uploaded;
  try {
    uploaded = await uploadImageField(formData, `posts/${postId}`, "image", { enforceUserQuota: true });
  } catch (e) {
    if (e instanceof UserStorageQuotaError) return { error: e.message };
    console.error("[crear] subida falló:", e);
    return { error: "No pudimos subir la foto. Intenta de nuevo." };
  }
  if (!uploaded) return { error: "Elige una foto." };
  const { data, error } = await ctx.supabase
    .from("post_images")
    .insert({
      post_id: postId,
      cf_image_id: uploaded.key,
      position,
      bytes: uploaded.bytes,
      variants_ready: uploaded.variantsReady,
      width: uploaded.width,
      height: uploaded.height,
    })
    .select("id, cf_image_id, position, width, height")
    .single();
  if (error || !data) {
    await deleteFromR2([uploaded.key]);
    return { error: dbError(error, "No pudimos guardar la foto. Intenta de nuevo.") };
  }
  return { image: { id: data.id, key: data.cf_image_id, position: data.position, width: data.width, height: data.height } };
}

/** Crea el borrador con la primera foto y abre el editor. */
export async function createLook(formData: FormData): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const { data: post, error } = await ctx.supabase
    .from("posts")
    .insert({ author_type: "user", author_user_id: ctx.me, status: "draft" })
    .select("id")
    .single();
  if (error || !post) return { ok: false, error: dbError(error, "No pudimos crear el look. Intenta de nuevo.") };
  const res = await storeImage(ctx, post.id, formData, 0);
  if ("error" in res) {
    await ctx.supabase.from("posts").delete().eq("id", post.id);
    return { ok: false, error: res.error ?? "No pudimos subir la foto." };
  }
  revalidatePath("/crear");
  redirect(`/crear/${post.id}`);
}

export async function addLookImage(
  postId: string,
  formData: FormData,
): Promise<ActionResult<{ image: { id: string; key: string; position: number; width: number | null; height: number | null } }>> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  const { data: imgs } = await ctx.supabase.from("post_images").select("position").eq("post_id", postId);
  if ((imgs?.length ?? 0) >= LOOK_LIMITS.photos) return { ok: false, error: "Un look puede tener hasta 4 fotos." };
  const next = Math.max(-1, ...(imgs ?? []).map((i) => i.position)) + 1;
  const res = await storeImage(ctx, postId, formData, next);
  if ("error" in res) return { ok: false, error: res.error ?? "No pudimos subir la foto." };
  touch(postId);
  return { ok: true, image: res.image };
}

export async function removeLookImage(postId: string, imageId: string): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  const { data: imgs } = await ctx.supabase.from("post_images").select("id, cf_image_id").eq("post_id", postId);
  const target = (imgs ?? []).find((i) => i.id === imageId);
  if (!target) return { ok: false, error: "Esa foto ya no está en el look." };
  if (look.status === "published" && (imgs?.length ?? 0) <= 1)
    return { ok: false, error: "Un look publicado necesita al menos una foto. Sube otra antes de quitar esta." };
  const { error } = await ctx.supabase.from("post_images").delete().eq("id", imageId).eq("post_id", postId);
  if (error) return { ok: false, error: dbError(error) };
  await deleteFromR2([target.cf_image_id]);
  touch(postId);
  return { ok: true };
}

/** La primera foto de la lista es la principal (la que sale en el feed). */
export async function reorderLookImages(postId: string, imageIds: string[]): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  const results = await Promise.all(
    imageIds.map((id, position) => ctx.supabase.from("post_images").update({ position }).eq("id", id).eq("post_id", postId)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: dbError(failed.error) };
  touch(postId);
  return { ok: true };
}

// ── prendas del catálogo ───────────────────────────────────────────────────────────────────

export type GarmentResult = { id: string; title: string; brandName: string; image: string | null; priceCop: number | null };

export async function searchGarmentsForLook(q: string): Promise<GarmentResult[]> {
  const ctx = await requireLookUser();
  const text = q.trim();
  if (text.length < 2) return [];
  const { data } = await ctx.supabase.rpc("search_garments", { q: text, p_sort: "relevant" });
  return (data ?? []).slice(0, 20).map((g) => ({
    id: g.id,
    title: g.title,
    brandName: g.brand_name,
    image: g.image,
    priceCop: g.price_cop,
  }));
}

export async function tagGarment(postId: string, garmentId: string): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  if (!isUuid(garmentId)) return { ok: false, error: "Esa prenda no está disponible." };
  const { error } = await ctx.supabase.from("post_items").insert({ post_id: postId, garment_id: garmentId });
  if (error) return { ok: false, error: dbError(error, "Esa prenda no está disponible.") };
  touch(postId);
  return { ok: true };
}

export async function untagGarment(postId: string, itemId: string): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  if (look.status === "published" && (await totalTagged(ctx, postId)) <= 1) return { ok: false, error: NEEDS_ONE_TAG };
  const { error } = await ctx.supabase.from("post_items").delete().eq("id", itemId).eq("post_id", postId);
  if (error) return { ok: false, error: dbError(error) };
  touch(postId);
  return { ok: true };
}

// ── estilo, ocasión y texto ───────────────────────────────────────────────────────────────

export async function setLookTags(
  postId: string,
  { styleIds, occasionIds }: { styleIds: string[]; occasionIds: string[] },
): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  const styles = [...new Set(styleIds.filter(isUuid))];
  const occasions = [...new Set(occasionIds.filter(isUuid))];
  if (styles.length > LOOK_LIMITS.styles) return { ok: false, error: "Elige hasta 6 estilos." };
  if (occasions.length > LOOK_LIMITS.occasions) return { ok: false, error: "Elige hasta 3 ocasiones." };
  if (look.status === "published" && !styles.length)
    return { ok: false, error: "Un look publicado necesita al menos un estilo." };
  if (look.status === "published" && !occasions.length)
    return { ok: false, error: "Un look publicado necesita al menos una ocasión." };

  const wanted = [...styles, ...occasions];
  const { data: current } = await ctx.supabase.from("post_tags").select("tag_id").eq("post_id", postId);
  const have = new Set((current ?? []).map((t) => t.tag_id));
  const toRemove = [...have].filter((id) => !wanted.includes(id));
  const toAdd = wanted.filter((id) => !have.has(id));
  if (toRemove.length) {
    const { error } = await ctx.supabase.from("post_tags").delete().eq("post_id", postId).in("tag_id", toRemove);
    if (error) return { ok: false, error: dbError(error) };
  }
  if (toAdd.length) {
    const { error } = await ctx.supabase.from("post_tags").insert(toAdd.map((tag_id) => ({ post_id: postId, tag_id })));
    if (error) return { ok: false, error: dbError(error) };
  }
  touch(postId);
  return { ok: true };
}

export async function createStyleForLook(name: string): Promise<ActionResult<{ tag: { id: string; name: string } }>> {
  const ctx = await requireLookUser();
  const { data, error } = await ctx.supabase.rpc("create_style_tag", { p_name: name });
  const tag = data?.[0];
  if (error || !tag) return { ok: false, error: dbError(error, "No pudimos crear el estilo.") };
  return { ok: true, tag: { id: tag.id, name: tag.name } };
}

export async function setLookCaption(postId: string, caption: string): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  const text = caption.trim();
  if (text.length > LOOK_LIMITS.caption) return { ok: false, error: "El texto puede tener hasta 500 caracteres." };
  const { error } = await ctx.supabase.from("posts").update({ caption: text || null }).eq("id", postId);
  if (error) return { ok: false, error: dbError(error) };
  touch(postId);
  if (look.status === "published") revalidatePath(`/post/${postId}`);
  return { ok: true };
}

// ── publicar, despublicar y borrar ─────────────────────────────────────────────────────────

export async function publishLook(postId: string): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  if (look.status !== "published") {
    // La base valida todo (completitud, límite diario, bloqueo) y responde en español.
    const { error } = await ctx.supabase.from("posts").update({ status: "published" }).eq("id", postId);
    if (error) return { ok: false, error: dbError(error, "No pudimos publicar el look. Intenta de nuevo.") };
  }
  revalidatePath("/feed");
  revalidatePath("/crear");
  redirect(`/post/${postId}?ok=publicado`);
}

export async function unpublishLook(postId: string): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  const { error } = await ctx.supabase.from("posts").update({ status: "draft" }).eq("id", postId);
  if (error) return { ok: false, error: dbError(error) };
  touch(postId);
  revalidatePath(`/post/${postId}`);
  revalidatePath("/feed");
  return { ok: true };
}

export async function deleteLook(postId: string): Promise<ActionResult> {
  const ctx = await requireLookUser();
  if (!isUuid(postId)) return { ok: false, error: "No encontramos ese look." };
  // Un look retirado por el equipo también se puede borrar: es contenido de quien lo publicó.
  const keys = await imageKeysFor(ctx.supabase, { postIds: [postId] });
  const { data, error } = await ctx.supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("author_user_id", ctx.me)
    .eq("author_type", "user")
    .select("id");
  if (error) return { ok: false, error: dbError(error, "No pudimos borrar el look.") };
  if (!data?.length) return { ok: false, error: "No encontramos ese look." };
  await deleteFromR2(keys);
  revalidatePath("/feed");
  revalidatePath("/crear");
  redirect("/crear?ok=borrado");
}

// ── marcas (US3) ──────────────────────────────────────────────────────────────────────────

export type BrandResult = { kind: "brand" | "stub"; id: string; name: string; slug: string | null };

export async function searchBrandsForLook(q: string): Promise<BrandResult[]> {
  const ctx = await requireLookUser();
  const text = q.trim();
  if (!text) return [];
  const { data } = await ctx.supabase.rpc("search_brand_mentions", { q: text });
  return (data ?? []).map((r) => ({ kind: r.kind, id: r.id, name: r.name, slug: r.slug }));
}

type BrandRef = { brandId: string } | { stubId: string } | { name: string };

/** Resuelve la referencia a marca: con `name` obtiene o crea la marca mencionada (o devuelve la de Icon). */
async function resolveBrand(ctx: Ctx, ref: BrandRef): Promise<{ brandId: string | null; stubId: string | null } | { error: string }> {
  if ("brandId" in ref) return isUuid(ref.brandId) ? { brandId: ref.brandId, stubId: null } : { error: "Esa marca no está disponible." };
  if ("stubId" in ref) return isUuid(ref.stubId) ? { brandId: null, stubId: ref.stubId } : { error: "Esa marca no está disponible." };
  const { data, error } = await ctx.supabase.rpc("get_or_create_brand_stub", { p_name: ref.name });
  if (error || !data) return { error: dbError(error, "No pudimos agregar esa marca.") };
  const r = data as { kind: "brand" | "stub"; id: string };
  return r.kind === "brand" ? { brandId: r.id, stubId: null } : { brandId: null, stubId: r.id };
}

export async function mentionBrand(postId: string, ref: BrandRef): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  const brand = await resolveBrand(ctx, ref);
  if ("error" in brand) return { ok: false, error: brand.error };
  const { error } = await ctx.supabase
    .from("post_brand_mentions")
    .insert({ post_id: postId, brand_id: brand.brandId, brand_stub_id: brand.stubId });
  if (error) return { ok: false, error: dbError(error, "No pudimos agregar esa marca.") };
  touch(postId);
  return { ok: true };
}

export async function removeMention(postId: string, mentionId: string): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  if (look.status === "published" && (await totalTagged(ctx, postId)) <= 1) return { ok: false, error: NEEDS_ONE_TAG };
  const { error } = await ctx.supabase.from("post_brand_mentions").delete().eq("id", mentionId).eq("post_id", postId);
  if (error) return { ok: false, error: dbError(error) };
  touch(postId);
  return { ok: true };
}

// ── prendas propuestas (US4) ──────────────────────────────────────────────────────────────

export async function createProposedGarment(
  postId: string,
  input: { name: string; categoryId: string; colorIds: string[]; brand?: BrandRef | null },
): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 80) return { ok: false, error: "El nombre debe tener entre 3 y 80 caracteres." };
  if (!isUuid(input.categoryId)) return { ok: false, error: "Elige una categoría." };
  const colorIds = [...new Set(input.colorIds.filter(isUuid))];
  if (colorIds.length > 3) return { ok: false, error: "Elige hasta 3 colores." };
  if ((await totalTagged(ctx, postId)) >= LOOK_LIMITS.items)
    return { ok: false, error: "Un look puede tener hasta 10 prendas o marcas etiquetadas." };

  let brandId: string | null = null;
  let stubId: string | null = null;
  if (input.brand) {
    const brand = await resolveBrand(ctx, input.brand);
    if ("error" in brand) return { ok: false, error: brand.error };
    brandId = brand.brandId;
    stubId = brand.stubId;
  }

  const { data: garment, error } = await ctx.supabase
    .from("proposed_garments")
    .insert({ name, category_tag_id: input.categoryId, brand_id: brandId, brand_stub_id: stubId, created_by_user_id: ctx.me })
    .select("id")
    .single();
  if (error || !garment) return { ok: false, error: dbError(error, "No pudimos crear la prenda.") };

  if (colorIds.length) {
    const { error: cErr } = await ctx.supabase
      .from("proposed_garment_colors")
      .insert(colorIds.map((color_id) => ({ proposed_garment_id: garment.id, color_id })));
    if (cErr) {
      await ctx.supabase.from("proposed_garments").delete().eq("id", garment.id);
      return { ok: false, error: dbError(cErr) };
    }
  }
  const { error: linkErr } = await ctx.supabase
    .from("post_proposed_items")
    .insert({ post_id: postId, proposed_garment_id: garment.id });
  if (linkErr) {
    await ctx.supabase.from("proposed_garments").delete().eq("id", garment.id);
    return { ok: false, error: dbError(linkErr) };
  }
  touch(postId);
  return { ok: true };
}

export async function removeProposedGarment(postId: string, itemId: string): Promise<ActionResult> {
  const ctx = await requireLookUser();
  const look = await ownLook(ctx, postId);
  if ("error" in look) return { ok: false, error: look.error };
  if (look.status === "published" && (await totalTagged(ctx, postId)) <= 1) return { ok: false, error: NEEDS_ONE_TAG };
  // La prenda propuesta se borra sola si queda sin looks (trigger post_proposed_items_cleanup).
  const { error } = await ctx.supabase.from("post_proposed_items").delete().eq("id", itemId).eq("post_id", postId);
  if (error) return { ok: false, error: dbError(error) };
  touch(postId);
  return { ok: true };
}
