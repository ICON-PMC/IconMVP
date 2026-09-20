"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyBrand } from "@/lib/auth";
import { uploadImageField } from "@/lib/upload";
import {
  normalizeBrandLink,
  slugify,
  validateBrandProfile,
  type BrandProfileInput,
  type FieldErrors,
} from "@/lib/brand-registration";

export type GarmentFieldErrors = Partial<
  Record<"title" | "price" | "category" | "photo" | "link", string>
>;

export type GarmentFormState = {
  errors?: GarmentFieldErrors;
  message?: string;
  values?: { title?: string; price?: string; category?: string; link?: string };
};

export type BrandFormState = {
  errors?: FieldErrors;
  message?: string;
  values?: Partial<BrandProfileInput>;
};

const MAX_COVER_BYTES = 10 * 1024 * 1024;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// Paso 1: crea (o actualiza) la marca en estado `pending`, sin `submitted_at` — el envío a
// revisión ocurre al final del onboarding (grupo 3). Vincula al usuario como dueño.
export async function saveBrandProfile(
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/onboarding/marca");

  const values: BrandProfileInput = {
    name: text(formData, "name"),
    bio: text(formData, "bio"),
    city: text(formData, "city"),
    link: text(formData, "link"),
  };
  const errors = validateBrandProfile(values);
  if (Object.keys(errors).length) return { errors, values };

  const fields = {
    name: values.name,
    bio: values.bio,
    city_id: values.city,
    store_url: normalizeBrandLink(values.link),
  };

  const supabase = await createClient();
  const existing = await getMyBrand();

  if (existing) {
    const { error } = await supabase.from("brands").update(fields).eq("id", existing.id);
    if (error) {
      console.error("[onboarding/marca] actualizar marca falló:", error.code, error.message);
      return { message: "No pudimos guardar tu perfil. Intenta de nuevo.", values };
    }
  } else {
    const baseSlug = slugify(values.name);
    let created = false;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const { error } = await supabase.from("brands").insert({
        ...fields,
        slug: attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`,
        owner_user_id: session.profile.id,
      });
      if (!error) created = true;
      else if (error.code !== "23505") {
        console.error("[onboarding/marca] crear marca falló:", error.code, error.message);
        return { message: "No pudimos crear tu marca. Intenta de nuevo.", values };
      }
    }
    if (!created)
      return { errors: { name: "Ese nombre ya está en uso. Prueba con otro." }, values };

    if (session.profile.role === "user") {
      await supabase.from("users").update({ role: "brand" }).eq("id", session.profile.id);
    }
  }

  revalidatePath("/", "layout");
  redirect("/onboarding/marca?paso=2");
}

// Paso 2: foto de portada → R2 (clave, no URL). Se guarda en `brands.logo_url`, la única
// columna de imagen de la marca.
export async function saveBrandCover(
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const brand = await getMyBrand();
  if (!brand) redirect("/onboarding/marca");

  const file = formData.get("image");
  const hasFile = file instanceof File && file.size > 0;

  if (!hasFile && !brand.logo_url)
    return { errors: { cover: "Sube una foto de portada para continuar." } };
  if (hasFile) {
    if (!file.type.startsWith("image/"))
      return { errors: { cover: "El archivo debe ser una imagen (JPG, PNG o WebP)." } };
    if (file.size > MAX_COVER_BYTES)
      return { errors: { cover: "La imagen pesa más de 10 MB. Prueba con una más liviana." } };

    let key: string | null;
    try {
      key = await uploadImageField(formData, `brands/${brand.id}/cover`);
    } catch (e) {
      console.error("[onboarding/marca] subida de portada falló:", e);
      return { message: "No pudimos subir la imagen. Intenta de nuevo." };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("brands").update({ logo_url: key }).eq("id", brand.id);
    if (error) {
      console.error("[onboarding/marca] guardar portada falló:", error.code, error.message);
      return { message: "No pudimos guardar la imagen. Intenta de nuevo." };
    }
  }

  revalidatePath("/", "layout");
  redirect("/onboarding/marca?paso=3");
}

// Paso 3: guarda una prenda. La marca aún no está aprobada, así que el trigger
// `garments_protect_status` la deja en `pending`; se publica cuando staff aprueba la marca.
export async function addOnboardingGarment(
  _prev: GarmentFormState,
  formData: FormData,
): Promise<GarmentFormState> {
  const brand = await getMyBrand();
  if (!brand) redirect("/onboarding/marca");

  const title = text(formData, "title");
  const priceRaw = text(formData, "price").replace(/[.\s$]/g, "");
  const category = text(formData, "category");
  const linkRaw = text(formData, "link");
  const photo = formData.get("image");
  const values = { title, price: text(formData, "price"), category, link: linkRaw };

  const errors: GarmentFieldErrors = {};
  if (!title) errors.title = "Escribe el nombre de la prenda.";
  else if (title.length > 100) errors.title = "Máximo 100 caracteres.";
  if (!priceRaw) errors.price = "Indica el precio en pesos.";
  else if (!/^\d+$/.test(priceRaw) || Number(priceRaw) <= 0)
    errors.price = "Ingresa un precio válido, solo números.";
  if (!category) errors.category = "Elige una categoría.";
  const productUrl = linkRaw ? normalizeBrandLink(linkRaw) : null;
  if (linkRaw && (!productUrl || !/^https?:\/\/[^/]+\./.test(productUrl)))
    errors.link = "Ingresa un enlace válido.";
  if (!(photo instanceof File) || photo.size === 0) errors.photo = "Sube una foto de la prenda.";
  else if (!photo.type.startsWith("image/"))
    errors.photo = "El archivo debe ser una imagen (JPG, PNG o WebP).";
  else if (photo.size > MAX_COVER_BYTES)
    errors.photo = "La imagen pesa más de 10 MB. Prueba con una más liviana.";
  if (Object.keys(errors).length) return { errors, values };

  const supabase = await createClient();
  const { data: garment, error } = await supabase
    .from("garments")
    .insert({
      brand_id: brand.id,
      title,
      price_cop: Number(priceRaw),
      product_url: productUrl,
      status: "pending",
      source: "brand",
    })
    .select("id")
    .single();
  if (error || !garment) {
    console.error("[onboarding/marca] crear prenda falló:", error?.code, error?.message);
    return { message: "No pudimos guardar la prenda. Intenta de nuevo.", values };
  }

  const { error: tagErr } = await supabase
    .from("garment_tags")
    .insert({ garment_id: garment.id, tag_id: category });

  let key: string | null = null;
  try {
    key = await uploadImageField(formData, `garments/${garment.id}`);
  } catch (e) {
    console.error("[onboarding/marca] subida de prenda falló:", e);
  }
  const imgErr = key
    ? (
        await supabase
          .from("garment_images")
          .insert({ garment_id: garment.id, cf_image_id: key, position: 0 })
      ).error
    : true;

  // Sin foto o sin categoría no es una prenda válida: no dejar registros a medias.
  if (tagErr || imgErr) {
    console.error("[onboarding/marca] categoría/imagen falló:", tagErr?.message, imgErr === true ? "sin clave R2" : imgErr?.message);
    await supabase.from("garments").delete().eq("id", garment.id);
    return { message: "No pudimos subir la foto o la categoría. Intenta de nuevo.", values };
  }

  revalidatePath("/onboarding/marca");
  redirect("/onboarding/marca?paso=3");
}

export async function removeOnboardingGarment(formData: FormData) {
  const brand = await getMyBrand();
  if (!brand) redirect("/onboarding/marca");
  const id = text(formData, "id");
  if (id) {
    const supabase = await createClient();
    await supabase.from("garments").delete().eq("id", id).eq("brand_id", brand.id);
  }
  revalidatePath("/onboarding/marca");
  redirect("/onboarding/marca?paso=3");
}

// Envía la marca a revisión: exige ≥1 prenda guardada. Primer envío (`pending`): fija
// `submitted_at`. Reenvío tras rechazo (`rejected`): pasa a `pending`; el trigger
// `brands_protect_curation_fields` limpia `rejection_note` y reinicia `submitted_at`.
// La aprobación/rechazo es del staff (grupo 5).
export async function submitBrandForReview() {
  const brand = await getMyBrand();
  if (!brand) redirect("/onboarding/marca");
  if (brand.status === "active") redirect("/marca/panel");

  const supabase = await createClient();
  const { count } = await supabase
    .from("garments")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brand.id);
  if (!count) redirect("/onboarding/marca?paso=3");

  if (brand.status === "rejected") {
    const { error } = await supabase
      .from("brands")
      .update({ status: "pending" })
      .eq("id", brand.id);
    if (error) redirect("/onboarding/marca?paso=3");
  } else if (!brand.submitted_at) {
    const { error } = await supabase
      .from("brands")
      .update({ submitted_at: new Date().toISOString() })
      .eq("id", brand.id);
    if (error) redirect("/onboarding/marca?paso=3");
  }

  revalidatePath("/", "layout");
  redirect("/onboarding/marca");
}
