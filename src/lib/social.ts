import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

// Helpers de lectura del flujo social (seguir marcas / dar like a posts).
// Mismo patrón que getMySavedIds(): vacíos si el usuario es anónimo.

// Ids de las marcas que sigue el usuario actual.
export async function getMyFollowedBrandIds(): Promise<Set<string>> {
  const session = await getCurrentUser();
  if (!session?.profile) return new Set();

  const supabase = await createClient();
  const { data } = await supabase
    .from("brand_follows")
    .select("brand_id")
    .eq("user_id", session.profile.id);

  return new Set((data ?? []).map((r) => r.brand_id));
}

// Ids de los posts a los que el usuario actual dio like.
export async function getMyLikedPostIds(): Promise<Set<string>> {
  const session = await getCurrentUser();
  if (!session?.profile) return new Set();

  const supabase = await createClient();
  const { data } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", session.profile.id);

  return new Set((data ?? []).map((r) => r.post_id));
}

// Ids de las prendas a las que el usuario actual dio like.
export async function getMyLikedGarmentIds(): Promise<Set<string>> {
  const session = await getCurrentUser();
  if (!session?.profile) return new Set();

  const supabase = await createClient();
  const { data } = await supabase
    .from("garment_likes")
    .select("garment_id")
    .eq("user_id", session.profile.id);

  return new Set((data ?? []).map((r) => r.garment_id));
}

// Conteo de likes por prenda. La vista `feed_items` ya trae `like_count`, pero las pantallas
// que leen de la tabla `garments` (`/prenda/[id]`, `/saved`, `/marca/[slug]`) no lo tienen.
export async function getGarmentLikeCounts(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from("garment_likes")
    .select("garment_id")
    .in("garment_id", ids);

  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    counts.set(r.garment_id, (counts.get(r.garment_id) ?? 0) + 1);
  }
  return counts;
}

// Marcas que sigue el usuario actual, con todo lo que necesita el `BrandCard` del
// tab "Siguiendo" de /saved (Grupo 4).
export type FollowedBrand = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  city_name: string | null;
  is_verified: boolean;
  is_sustainable: boolean;
  garments: number; // prendas PUBLICADAS de la marca (mismo criterio que search_brands)
};

export async function getMyFollowedBrands(): Promise<FollowedBrand[]> {
  const session = await getCurrentUser();
  if (!session?.profile) return [];

  const supabase = await createClient();
  const { data: follows } = await supabase
    .from("brand_follows")
    .select("brand_id, created_at")
    .eq("user_id", session.profile.id)
    .order("created_at", { ascending: false });

  const brandIds = (follows ?? []).map((f) => f.brand_id);
  if (brandIds.length === 0) return [];

  // `is_active = true` deja fuera una marca dada de baja después de seguirla.
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug, city_id, bio, is_verified, is_sustainable")
    .in("id", brandIds)
    .eq("is_active", true);

  const cityIds = [
    ...new Set((brands ?? []).map((b) => b.city_id).filter((x): x is string => Boolean(x))),
  ];
  const cities = cityIds.length
    ? ((await supabase.from("cities").select("id, name").in("id", cityIds)).data ?? [])
    : [];
  const cityName = (id: string | null) =>
    id ? (cities.find((c) => c.id === id)?.name ?? null) : null;

  // Conteo de prendas publicadas por marca: una sola query (solo trae brand_id) y se
  // cuenta en JS. Mismo criterio que el `garments` del RPC search_brands.
  const { data: garmentRows } = await supabase
    .from("garments")
    .select("brand_id")
    .in("brand_id", brandIds)
    .eq("status", "published");
  const garmentCount = new Map<string, number>();
  for (const g of garmentRows ?? []) {
    garmentCount.set(g.brand_id, (garmentCount.get(g.brand_id) ?? 0) + 1);
  }

  // Preserva el orden de follows (más reciente primero).
  const byId = new Map((brands ?? []).map((b) => [b.id, b]));
  return brandIds
    .map((id) => byId.get(id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      bio: b.bio,
      city_name: cityName(b.city_id),
      is_verified: b.is_verified,
      is_sustainable: b.is_sustainable,
      garments: garmentCount.get(b.id) ?? 0,
    }));
}
