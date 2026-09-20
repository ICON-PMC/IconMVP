"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isStaff, requireStaff } from "@/lib/auth";
import { uploadImageField } from "@/lib/upload";

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  const s = v ? String(v).trim() : "";
  return s === "" ? null : s;
}

// Sube la imagen del formulario a R2 (redimensionada) y devuelve la clave, o null.
const uploadImage = (formData: FormData, keyPrefix: string) =>
  uploadImageField(formData, keyPrefix);

export async function createBrand(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("brands").insert({
    name: str(formData, "name") ?? "",
    slug: str(formData, "slug") ?? "",
    city_id: str(formData, "city_id"),
    store_url: str(formData, "store_url"),
    instagram: str(formData, "instagram"),
    price_range: (str(formData, "price_range") as never) ?? null,
    bio: str(formData, "bio"),
    is_verified: formData.get("is_verified") === "on",
    is_sustainable: formData.get("is_sustainable") === "on",
  });
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin");
  redirect("/admin?ok=marca");
}

export async function createGarment(formData: FormData) {
  await requireStaff();
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
      product_url: str(formData, "product_url"),
      color: str(formData, "color"),
      fabric: str(formData, "fabric"),
      status,
      source: "team",
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !garment)
    redirect(`/admin?error=${encodeURIComponent(error?.message ?? "garment")}`);

  const categoryId = str(formData, "category");
  if (categoryId) {
    await supabase
      .from("garment_tags")
      .insert({ garment_id: garment.id, tag_id: categoryId });
  }
  const sizeIds = formData.getAll("sizes").map(String);
  if (sizeIds.length) {
    await supabase
      .from("garment_sizes")
      .insert(sizeIds.map((size_id) => ({ garment_id: garment.id, size_id })));
  }
  const key = await uploadImage(formData, `garments/${garment.id}`);
  if (key) {
    await supabase
      .from("garment_images")
      .insert({ garment_id: garment.id, cf_image_id: key, position: 0 });
  }

  revalidatePath("/admin");
  redirect("/admin?ok=prenda");
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
    redirect(`/admin?error=${encodeURIComponent(error?.message ?? "post")}`);

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
  const key = await uploadImage(formData, `posts/${post.id}`);
  if (key) {
    await supabase
      .from("post_images")
      .insert({ post_id: post.id, cf_image_id: key, position: 0 });
  }

  revalidatePath("/admin");
  revalidatePath("/feed");
  redirect("/admin?ok=post");
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
