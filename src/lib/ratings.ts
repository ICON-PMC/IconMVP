import { createClient } from "@/lib/supabase/server";
import { RATINGS_PAGE, summaryFrom, type RatingSummary } from "@/lib/rating-rules";

export * from "@/lib/rating-rules";

// Reseñas de marcas (spec 011, contracts §1). En la base: `brand_ratings` (≠ post_brand_reviews).

export type RatingRow = {
  id: string;
  stars: 1 | 2 | 3 | 4 | 5;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: { id: string; handle: string; name: string; avatar: string | null; isPublic: boolean };
};

export type RatingSort = "recent" | "high" | "low";

export async function getRatingSummary(brandId: string): Promise<RatingSummary> {
  const supabase = await createClient();
  const { data } = await supabase.from("brands").select("rating_avg, rating_count, rating_dist").eq("id", brandId).maybeSingle();
  return summaryFrom(data ?? { rating_avg: null, rating_count: 0, rating_dist: null });
}

export async function getRatings(
  brandId: string,
  opts: { sort: RatingSort; stars?: number; offset: number; limit?: number },
): Promise<{ items: RatingRow[]; nextOffset: number | null }> {
  const supabase = await createClient();
  const limit = opts.limit ?? RATINGS_PAGE;
  const { data, error } = await supabase.rpc("brand_ratings_page", {
    p_brand_id: brandId,
    p_sort: opts.sort,
    p_stars: opts.stars ?? null,
    p_limit: limit,
    p_offset: opts.offset,
  });
  if (error) console.error("[ratings] brand_ratings_page falló:", error.message);
  const items: RatingRow[] = (data ?? []).map((r) => ({
    id: r.id,
    stars: r.stars as RatingRow["stars"],
    body: r.body,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    author: { id: r.author_id, handle: r.author_handle, name: r.author_name, avatar: r.author_avatar, isPublic: r.author_public },
  }));
  return { items, nextOffset: items.length === limit ? opts.offset + limit : null };
}

export type MyRating = { id: string; stars: number; body: string; status: "published" | "auto_hidden" | "removed" };

export async function getMyRating(brandId: string, myId: string | null | undefined): Promise<MyRating | null> {
  if (!myId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("brand_ratings")
    .select("id, stars, body, status")
    .eq("brand_id", brandId)
    .eq("user_id", myId)
    .maybeSingle();
  return data;
}
