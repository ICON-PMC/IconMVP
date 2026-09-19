"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireBrandOwner } from "@/lib/auth";
import { uploadImageField, uploadImageFromUrl } from "@/lib/upload";
import { fetchRecentMedia } from "@/lib/instagram";

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  const s = v ? String(v).trim() : "";
  return s === "" ? null : s;
}

async function myBrandIdOrRedirect(): Promise<string> {
  const { brand } = await requireBrandOwner();
  if (!brand) redirect("/marca/panel");
  return brand.id;
}

// ============================================================
// Perfil de la marca
// ============================================================
export async function updateBrandProfile(formData: FormData) {
  const brandId = await myBrandIdOrRedirect();
  const supabase = await createClient();
  const { error } = await supabase
    .from("brands")
    .update({
      name: str(formData, "name") ?? "",
      store_url: str(formData, "store_url"),
      instagram: str(formData, "instagram"),
      bio: str(formData, "bio"),
    })
    .eq("id", brandId);
  if (error) redirect(`/marca/panel?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/marca/panel");
  redirect("/marca/panel?ok=perfil");
}

// ============================================================
// Catálogo (prendas) — mismos campos que /admin, sin elegir marca (es la propia).
// ============================================================
export async function createBrandGarment(formData: FormData) {
  const brandId = await myBrandIdOrRedirect();
  const supabase = await createClient();

  const priceRaw = str(formData, "price_cop");
  const { data: garment, error } = await supabase
    .from("garments")
    .insert({
      brand_id: brandId,
      title: str(formData, "title") ?? "",
      description: str(formData, "description"),
      price_cop: priceRaw ? Number(priceRaw) : null,
      product_url: str(formData, "product_url"),
      color: str(formData, "color"),
      fabric: str(formData, "fabric"),
      status: "published",
      source: "brand",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !garment)
    redirect(`/marca/panel?error=${encodeURIComponent(error?.message ?? "prenda")}`);

  const categoryId = str(formData, "category");
  if (categoryId) {
    await supabase.from("garment_tags").insert({ garment_id: garment.id, tag_id: categoryId });
  }
  const sizeIds = formData.getAll("sizes").map(String);
  if (sizeIds.length) {
    await supabase
      .from("garment_sizes")
      .insert(sizeIds.map((size_id) => ({ garment_id: garment.id, size_id })));
  }
  const key = await uploadImageField(formData, `garments/${garment.id}`);
  if (key) {
    await supabase
      .from("garment_images")
      .insert({ garment_id: garment.id, cf_image_id: key, position: 0 });
  }

  revalidatePath("/marca/panel");
  redirect("/marca/panel?ok=prenda");
}

// ============================================================
// Posts manuales (sin pasar por Instagram) — por si la marca prefiere subir directo.
// ============================================================
export async function createBrandPost(formData: FormData) {
  const brandId = await myBrandIdOrRedirect();
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_type: "brand",
      author_brand_id: brandId,
      caption: str(formData, "caption"),
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !post)
    redirect(`/marca/panel?error=${encodeURIComponent(error?.message ?? "post")}`);

  const key = await uploadImageField(formData, `posts/${post.id}`);
  if (key) {
    await supabase.from("post_images").insert({ post_id: post.id, cf_image_id: key, position: 0 });
  }

  revalidatePath("/marca/panel");
  redirect(`/marca/panel/post/${post.id}`);
}

// ============================================================
// Tagging manual: qué prenda del catálogo propio aparece en un post propio.
// ============================================================
// Estos cinco los invoca un <form action={...}> directo desde un server component (mismo
// patrón que src/app/saved/actions.ts): sin cliente que lea un valor de retorno, así que la
// señal de error es un redirect con ?error=, no un ActionResult.
export async function tagGarmentOnPost(formData: FormData) {
  await requireBrandOwner();
  const postId = String(formData.get("post_id") ?? "");
  const garmentId = String(formData.get("garment_id") ?? "");
  if (!postId || !garmentId) redirect("/marca/panel");
  const sizeId = str(formData, "size_id");

  const supabase = await createClient();
  const { error } = await supabase.from("post_items").insert({
    post_id: postId,
    garment_id: garmentId,
    size_id: sizeId,
  });
  if (error) {
    redirect(`/marca/panel/post/${postId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/marca/panel/post/${postId}`);
}

export async function untagGarmentFromPost(postId: string, itemId: string) {
  await requireBrandOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("post_items").delete().eq("id", itemId);
  if (error) {
    redirect(`/marca/panel/post/${postId}?error=${encodeURIComponent(error.message)}`);
  }

  // Si esa era la última prenda taggeada y el post ya estaba publicado, lo regresa a
  // borrador — un look publicado con cero prendas no tiene sentido (nada que mostrar en
  // el feed por intención) y publishPost() ya exige al menos una para publicar; sin este
  // chequeo simétrico, quitar la última prenda DESPUÉS de publicar dejaba el post
  // publicado mostrando nada.
  const { count } = await supabase
    .from("post_items")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);
  if (!count) {
    await supabase.from("posts").update({ status: "draft" }).eq("id", postId).eq("status", "published");
  }

  revalidatePath(`/marca/panel/post/${postId}`);
  revalidatePath("/marca/panel");
  revalidatePath("/feed");
}

export async function setPostTags(formData: FormData) {
  await requireBrandOwner();
  const postId = String(formData.get("post_id") ?? "");
  if (!postId) redirect("/marca/panel");
  const tagIds = [
    ...formData.getAll("occasions"),
    ...formData.getAll("styles"),
    ...formData.getAll("temperatures"),
  ].map(String);

  const supabase = await createClient();
  await supabase.from("post_tags").delete().eq("post_id", postId);
  if (tagIds.length) {
    const { error } = await supabase
      .from("post_tags")
      .insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id })));
    if (error) {
      redirect(`/marca/panel/post/${postId}?error=${encodeURIComponent(error.message)}`);
    }
  }
  revalidatePath(`/marca/panel/post/${postId}`);
}

export async function publishPost(postId: string) {
  await requireBrandOwner();
  const supabase = await createClient();
  const { count } = await supabase
    .from("post_items")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);
  if (!count) {
    redirect(
      `/marca/panel/post/${postId}?error=${encodeURIComponent("Taggea al menos una prenda antes de publicar.")}`,
    );
  }

  const { error } = await supabase
    .from("posts")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) {
    redirect(`/marca/panel/post/${postId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/marca/panel/post/${postId}`);
  revalidatePath("/marca/panel");
  revalidatePath("/feed");
}

export async function unpublishPost(postId: string) {
  await requireBrandOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("posts").update({ status: "draft" }).eq("id", postId);
  if (error) {
    redirect(`/marca/panel/post/${postId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/marca/panel/post/${postId}`);
  revalidatePath("/marca/panel");
  revalidatePath("/feed");
}

// ============================================================
// Importación desde Instagram
// ============================================================
export type IgMediaOption = {
  id: string;
  caption: string | null;
  imageUrl: string;
  permalink: string | null;
};

// Trae la media reciente de la marca conectada para que elija cuáles importar.
export async function listInstagramMedia(): Promise<
  { ok: true; items: IgMediaOption[] } | { ok: false; error: string }
> {
  const { brand } = await requireBrandOwner();
  if (!brand) return { ok: false, error: "No tienes una marca conectada." };

  const supabase = await createClient();
  const { data: conn } = await supabase
    .from("brand_instagram_connections")
    .select("access_token")
    .eq("brand_id", brand.id)
    .maybeSingle();
  if (!conn) return { ok: false, error: "Conecta tu Instagram primero." };

  try {
    const media = await fetchRecentMedia(conn.access_token);
    return {
      ok: true,
      items: media
        .filter((m) => m.media_url)
        .map((m) => ({
          id: m.id,
          caption: m.caption,
          imageUrl: m.media_url!,
          permalink: m.permalink,
        })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al leer Instagram." };
  }
}

// Importa las fotos elegidas como posts en borrador (sin prendas taggeadas todavía —
// eso se hace después, a mano, uno por uno).
export async function importInstagramMedia(
  items: { id: string; caption: string | null; imageUrl: string }[],
): Promise<{ ok: true; created: number; errors: string[] } | { ok: false; error: string }> {
  const { brand } = await requireBrandOwner();
  if (!brand) return { ok: false, error: "No tienes una marca conectada." };
  if (!items.length) return { ok: false, error: "No seleccionaste ninguna foto." };

  const supabase = await createClient();
  const errors: string[] = [];
  let created = 0;

  for (const item of items) {
    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        author_type: "brand",
        author_brand_id: brand.id,
        caption: item.caption,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !post) {
      errors.push(`${item.id}: ${error?.message ?? "no se pudo crear el post"}`);
      continue;
    }
    try {
      const key = await uploadImageFromUrl(item.imageUrl, `posts/${post.id}`);
      await supabase
        .from("post_images")
        .insert({ post_id: post.id, cf_image_id: key, position: 0 });
      created++;
    } catch (e) {
      errors.push(`${item.id}: ${e instanceof Error ? e.message : "fallo al subir la imagen"}`);
    }
  }

  revalidatePath("/marca/panel");
  return { ok: true, created, errors };
}

export async function disconnectInstagram() {
  const { brand } = await requireBrandOwner();
  if (!brand) redirect("/marca/panel");
  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_instagram_connections")
    .delete()
    .eq("brand_id", brand.id);
  if (error) redirect(`/marca/panel?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/marca/panel");
}
