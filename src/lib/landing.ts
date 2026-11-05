import { createClient } from "@/lib/supabase/server";
import { imageUrl } from "@/lib/images";

// Prenda real publicada, lista para mostrarse en las landings.
export type LandingPhoto = {
  id: string;
  title: string;
  brand: string;
  city: string | null;
  price: number | null;
  src: string;
  href: string;
};

// Prendas publicadas con foto, en el orden "relevante" del feed (ya reparte por marca).
// Las landings las usan como fotos reales; si no hay suficientes, los componentes
// muestran un fondo de color de la paleta en vez de un hueco.
export async function getLandingPhotos(n = 12): Promise<LandingPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_feed", {
    p_sort: "relevant",
    p_limit: n * 2,
    p_offset: 0,
  });
  if (error) {
    console.error("[landing] get_feed falló:", error.message);
    return [];
  }
  const photos: LandingPhoto[] = [];
  for (const it of data ?? []) {
    const src = imageUrl(it.image);
    if (it.kind !== "garment" || !src) continue;
    photos.push({
      id: it.id,
      title: it.title ?? "Prenda",
      brand: it.brand_name,
      city: it.city_name,
      price: it.min_price,
      src,
      href: `/prenda/${it.id}`,
    });
    if (photos.length === n) break;
  }
  return photos;
}

export function formatCop(n: number | null): string | null {
  return n == null ? null : `$${n.toLocaleString("es-CO")}`;
}

// Número de WhatsApp del equipo (mismo del pie de página).
export const TEAM_WHATSAPP = "573152429478";

export function whatsappLink(text: string): string {
  return `https://wa.me/${TEAM_WHATSAPP}?text=${encodeURIComponent(text)}`;
}
