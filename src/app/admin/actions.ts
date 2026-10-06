"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isStaff, requireStaff } from "@/lib/auth";
import { uploadImageField } from "@/lib/upload";
import { normalizeInstagramHandle, normalizeUrl } from "@/lib/links";
import { replaceBrandStyles, tagIdsFromForm, type TagType } from "@/lib/tags";
import { slugify } from "@/lib/brand-registration";

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  const s = v ? String(v).trim() : "";
  return s === "" ? null : s;
}

// Sube la imagen del formulario a R2 (redimensionada) y devuelve clave y peso, o null.
// El staff sube sin bloqueo de cuota; el peso igual cuenta para la marca.
const uploadImage = (formData: FormData, keyPrefix: string) =>
  uploadImageField(formData, keyPrefix);

export async function createBrand(formData: FormData) {
  await requireStaff();
  const storeRaw = str(formData, "store_url");
  const store_url = normalizeUrl(storeRaw);
  if (storeRaw && !store_url)
    redirect(`/admin?tab=cargar&form=marca&error=${encodeURIComponent("El link de la tienda no es válido.")}`);
  const instagramRaw = str(formData, "instagram");
  const instagram = normalizeInstagramHandle(instagramRaw);
  if (instagramRaw && !instagram)
    redirect(`/admin?tab=cargar&form=marca&error=${encodeURIComponent("El usuario de Instagram no es válido.")}`);

  const supabase = await createClient();
  const { data: brand, error } = await supabase.from("brands").insert({
    name: str(formData, "name") ?? "",
    slug: str(formData, "slug") ?? "",
    city_id: str(formData, "city_id"),
    store_url,
    instagram,
    price_range: (str(formData, "price_range") as never) ?? null,
    bio: str(formData, "bio"),
    is_verified: formData.get("is_verified") === "on",
    is_sustainable: formData.get("is_sustainable") === "on",
  }).select("id").single();
  if (error || !brand)
    redirect(`/admin?tab=cargar&form=marca&error=${encodeURIComponent(error?.message ?? "marca")}`);
  const stylesError = await replaceBrandStyles(supabase, brand.id, tagIdsFromForm(formData, ["style"]));
  if (stylesError)
    redirect(`/admin?tab=cargar&form=marca&error=${encodeURIComponent(stylesError)}`);
  revalidatePath("/admin");
  redirect("/admin?tab=cargar&form=marca&ok=marca");
}

export async function createGarment(formData: FormData) {
  await requireStaff();
  const productUrlRaw = str(formData, "product_url");
  const product_url = normalizeUrl(productUrlRaw);
  if (productUrlRaw && !product_url)
    redirect(`/admin?tab=cargar&form=prenda&error=${encodeURIComponent("El link de compra no es válido.")}`);
  const supabase = await createClient();

  const status = (str(formData, "status") ?? "published") as
    | "pending"
    | "published"
    | "archived";
  const priceRaw = str(formData, "price_cop");

  const { data: garment, error } = await supabase
    .from("garments")
    .insert({
      brand_id: str(formData, "brand_id") ?? "",
      title: str(formData, "title") ?? "",
      description: str(formData, "description"),
      price_cop: priceRaw ? Number(priceRaw) : null,
      product_url,
      color: str(formData, "color"),
      fabric: str(formData, "fabric"),
      status,
      source: "team",
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !garment)
    redirect(`/admin?tab=cargar&form=prenda&error=${encodeURIComponent(error?.message ?? "garment")}`);

  const categoryId = str(formData, "category");
  const tagIds = [
    ...(categoryId ? [categoryId] : []),
    ...tagIdsFromForm(formData, ["style", "occasion", "temperature"]),
  ];
  if (tagIds.length) {
    await supabase
      .from("garment_tags")
      .insert(tagIds.map((tag_id) => ({ garment_id: garment.id, tag_id })));
  }
  const sizeIds = formData.getAll("sizes").map(String);
  if (sizeIds.length) {
    await supabase
      .from("garment_sizes")
      .insert(sizeIds.map((size_id) => ({ garment_id: garment.id, size_id })));
  }
  const img = await uploadImage(formData, `garments/${garment.id}`);
  if (img) {
    await supabase
      .from("garment_images")
      .insert({ garment_id: garment.id, cf_image_id: img.key, bytes: img.bytes, position: 0 });
  }

  revalidatePath("/admin");
  redirect("/admin?tab=cargar&form=prenda&ok=prenda");
}

export async function createPost(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();

  const status = (str(formData, "status") ?? "published") as
    | "draft"
    | "published"
    | "archived";

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_type: "team",
      author_brand_id: str(formData, "author_brand_id"),
      caption: str(formData, "caption"),
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !post)
    redirect(`/admin?tab=cargar&form=post&error=${encodeURIComponent(error?.message ?? "post")}`);

  const tagIds = [
    ...formData.getAll("occasions"),
    ...formData.getAll("styles"),
    ...formData.getAll("temperatures"),
  ].map(String);
  if (tagIds.length) {
    await supabase
      .from("post_tags")
      .insert(tagIds.map((tag_id) => ({ post_id: post.id, tag_id })));
  }
  const garmentIds = formData.getAll("garments").map(String);
  if (garmentIds.length) {
    await supabase
      .from("post_items")
      .insert(garmentIds.map((garment_id) => ({ post_id: post.id, garment_id })));
  }
  const img = await uploadImage(formData, `posts/${post.id}`);
  if (img) {
    await supabase
      .from("post_images")
      .insert({ post_id: post.id, cf_image_id: img.key, bytes: img.bytes, position: 0 });
  }

  revalidatePath("/admin");
  revalidatePath("/feed");
  redirect("/admin?tab=cargar&form=post&ok=post");
}

// ============================================================
// Cola de aprobación de marcas
// ============================================================
export type ReviewResult = { ok: true } | { ok: false; error: string };

// A diferencia de requireStaff() (que redirige), estas acciones devuelven un error para que
// la UI lo muestre; nunca lanzan 500 si las llama alguien sin permiso. La marca se entera del
// resultado al ingresar a su panel (banner de estado); las notificaciones por correo quedan
// para una fase posterior (ver specs/roadmap.md).
async function reviewBrand(
  fn: "approve_brand" | "reject_brand",
  brandId: string,
  note?: string,
): Promise<ReviewResult> {
  const session = await getCurrentUser();
  if (!isStaff(session?.profile)) return { ok: false, error: "No tienes permiso para esta acción." };

  const supabase = await createClient();
  const { error } =
    fn === "approve_brand"
      ? await supabase.rpc("approve_brand", { p_brand_id: brandId })
      : await supabase.rpc("reject_brand", { p_brand_id: brandId, p_note: note ?? null });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "No tienes permiso para esta acción." };
    if (error.code === "P0001") return { ok: false, error: error.message };
    console.error(`[admin] ${fn} falló:`, error.message);
    return { ok: false, error: "No se pudo completar la acción. Intenta de nuevo." };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function approveBrand(brandId: string): Promise<ReviewResult> {
  return reviewBrand("approve_brand", brandId);
}

export async function rejectBrand(brandId: string, note: string): Promise<ReviewResult> {
  return reviewBrand("reject_brand", brandId, note.slice(0, 500));
}

// ============================================================
// Vocabulario de etiquetas (/admin?tab=etiquetas)
// ============================================================
const TAG_TYPES: TagType[] = ["category", "style", "occasion", "temperature"];
const tagsUrl = (q: string) => `/admin?tab=etiquetas&${q}`;

function revalidateTags() {
  revalidatePath("/admin");
  revalidatePath("/feed");
  revalidatePath("/", "layout");
}

export async function createTag(formData: FormData) {
  await requireStaff();
  const type = str(formData, "type") as TagType | null;
  const name = str(formData, "name");
  if (!type || !TAG_TYPES.includes(type) || !name)
    redirect(tagsUrl(`error=${encodeURIComponent("Elige el tipo y escribe un nombre.")}`));
  const slug = slugify(name);
  if (!slug) redirect(tagsUrl(`error=${encodeURIComponent("El nombre no es válido.")}`));

  const supabase = await createClient();
  const { error } = await supabase.from("tags").insert({ type, name, slug });
  if (error)
    redirect(
      tagsUrl(
        `error=${encodeURIComponent(error.code === "23505" ? "Ya existe una etiqueta con ese nombre." : error.message)}`,
      ),
    );
  revalidateTags();
  redirect(tagsUrl("ok=etiqueta"));
}

// Solo el nombre visible: el slug no cambia porque está en las URLs de los filtros.
export async function renameTag(formData: FormData) {
  await requireStaff();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) redirect(tagsUrl(`error=${encodeURIComponent("Escribe un nombre.")}`));
  const supabase = await createClient();
  const { error } = await supabase.from("tags").update({ name }).eq("id", id);
  if (error) redirect(tagsUrl(`error=${encodeURIComponent(error.message)}`));
  revalidateTags();
  redirect(tagsUrl("ok=renombrada"));
}

// Se bloquea si está en uso: el `on delete cascade` la quitaría en silencio de prendas,
// posts, marcas y preferencias de usuario.
export async function deleteTag(formData: FormData) {
  await requireStaff();
  const id = str(formData, "id");
  if (!id) redirect(tagsUrl(""));
  const supabase = await createClient();
  const { data: usage, error: usageError } = await supabase.rpc("tag_usage_counts");
  if (usageError) redirect(tagsUrl(`error=${encodeURIComponent(usageError.message)}`));
  if ((usage ?? []).some((u) => u.tag_id === id && u.uses > 0))
    redirect(tagsUrl(`error=${encodeURIComponent("La etiqueta está en uso: no se puede borrar.")}`));
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) redirect(tagsUrl(`error=${encodeURIComponent(error.message)}`));
  revalidateTags();
  redirect(tagsUrl("ok=borrada"));
}

// ============================================================
// Sinónimos y palabras ignoradas de la búsqueda (/admin?tab=etiquetas)
// La base normaliza (minúsculas, sin acentos) y exige 2+ palabras por grupo.
// ============================================================
const splitWords = (raw: string | null) =>
  (raw ?? "").split(/[,\n]/).map((w) => w.trim()).filter(Boolean);

function revalidateSearch() {
  revalidatePath("/admin");
  revalidatePath("/feed");
}

export async function saveSynonymGroup(formData: FormData) {
  await requireStaff();
  const id = str(formData, "id");
  const terms = splitWords(str(formData, "terms"));
  if (terms.length < 2)
    redirect(tagsUrl(`error=${encodeURIComponent("Escribe al menos dos palabras separadas por coma.")}`));
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("search_synonyms").update({ terms }).eq("id", id)
    : await supabase.from("search_synonyms").insert({ terms });
  if (error) redirect(tagsUrl(`error=${encodeURIComponent(error.message)}`));
  revalidateSearch();
  redirect(tagsUrl("ok=sinonimos"));
}

export async function deleteSynonymGroup(formData: FormData) {
  await requireStaff();
  const id = str(formData, "id");
  if (!id) redirect(tagsUrl(""));
  const supabase = await createClient();
  const { error } = await supabase.from("search_synonyms").delete().eq("id", id);
  if (error) redirect(tagsUrl(`error=${encodeURIComponent(error.message)}`));
  revalidateSearch();
  redirect(tagsUrl("ok=sinonimos-borrados"));
}

export async function addStopwords(formData: FormData) {
  await requireStaff();
  const words = splitWords(str(formData, "words"));
  if (!words.length) redirect(tagsUrl(`error=${encodeURIComponent("Escribe al menos una palabra.")}`));
  const supabase = await createClient();
  const { error } = await supabase
    .from("search_stopwords")
    .upsert(words.map((word) => ({ word })), { onConflict: "word", ignoreDuplicates: true });
  if (error) redirect(tagsUrl(`error=${encodeURIComponent(error.message)}`));
  revalidateSearch();
  redirect(tagsUrl("ok=ignoradas"));
}

export async function deleteStopword(formData: FormData) {
  await requireStaff();
  const word = str(formData, "word");
  if (!word) redirect(tagsUrl(""));
  const supabase = await createClient();
  const { error } = await supabase.from("search_stopwords").delete().eq("word", word);
  if (error) redirect(tagsUrl(`error=${encodeURIComponent(error.message)}`));
  revalidateSearch();
  redirect(tagsUrl("ok=ignorada-borrada"));
}
