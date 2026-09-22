import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

// Fila del feed mixto: un post (outfit) o una prenda, con `kind` como discriminador.
export type FeedItem = Database["public"]["Functions"]["get_feed"]["Returns"][number];

export type FeedFiltersInput = {
  city: string[];
  occasion: string[];
  style: string[];
  category: string[];
  price: string[];
};

export const FEED_SORTS = new Set(["relevant", "new", "popular", "az"]);
export const FEED_PAGE_SIZE = 24;

type SearchParamsLike = { [key: string]: string | string[] | undefined };

// Parsea `searchParams` de /feed a filtros + orden. Comparte la lógica entre
// el render inicial (server) y el route handler de paginación.
export function parseFeedParams(sp: SearchParamsLike): {
  filters: FeedFiltersInput;
  sort: string;
} {
  const parse = (k: string) =>
    sp[k] ? String(sp[k]).split(",").filter(Boolean) : [];

  const filters: FeedFiltersInput = {
    city: parse("city"),
    occasion: parse("occasion"),
    style: parse("style"),
    category: parse("category"),
    price: parse("price"),
  };
  const sortRaw = sp.sort ? String(sp.sort) : "relevant";
  const sort = FEED_SORTS.has(sortRaw) ? sortRaw : "relevant";
  return { filters, sort };
}

export type FeedPage = {
  items: FeedItem[];
  nextOffset: number | null;
  error: string | null;
};

// Pide una página de `get_feed` con los filtros/orden ya parseados.
export async function getFeedPage(
  filters: FeedFiltersInput,
  sort: string,
  offset = 0,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_feed", {
    p_cities: filters.city.length ? filters.city : undefined,
    p_occasions: filters.occasion.length ? filters.occasion : undefined,
    p_styles: filters.style.length ? filters.style : undefined,
    p_categories: filters.category.length ? filters.category : undefined,
    p_prices: filters.price.length ? filters.price : undefined,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("[feed] get_feed falló:", error.message);
    return { items: [], nextOffset: null, error: error.message };
  }

  const items = data ?? [];
  const nextOffset = items.length === limit ? offset + limit : null;
  return { items, nextOffset, error: null };
}
