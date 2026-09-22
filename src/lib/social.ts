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

// Marcas que sigue el usuario actual, con lo mínimo para listarlas en "Siguiendo".
export type FollowedBrand = {
  id: string;
  name: string;
  slug: string;
  city_name: string | null;
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

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug, city_id")
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

  // Preserva el orden de follows (más reciente primero).
  const byId = new Map((brands ?? []).map((b) => [b.id, b]));
  return brandIds
    .map((id) => byId.get(id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      city_name: cityName(b.city_id),
    }));
}
