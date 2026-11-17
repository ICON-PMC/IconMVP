import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

// Fila del feed mixto: un post (outfit) o una prenda, con `kind` como discriminador.
export type FeedItem = Database["public"]["Functions"]["get_feed"]["Returns"][number];

export { feedItemAuthor } from "@/lib/feed-author";

export type FeedFiltersInput = {
  city: string[];
  occasion: string[];
  style: string[];
  category: string[];
  price: string[];
  color: string[];
  // Spec 003
  size: string[];
  brand: string[];
};

/** Precio libre en COP (spec 003): `pmin`/`pmax` en la URL. */
export type PriceRangeInput = { min: number | null; max: number | null };

// "rating" solo aplica a la pestaña Marcas de la búsqueda (spec 011).
export const FEED_SORTS = new Set(["relevant", "new", "popular", "az", "rating"]);
export const FEED_PAGE_SIZE = 24;

type SearchParamsLike = { [key: string]: string | string[] | undefined };

// Parsea `searchParams` de /feed a filtros + orden. Comparte la lógica entre
// el render inicial (server) y el route handler de paginación.
export function parseFeedParams(sp: SearchParamsLike): {
  filters: FeedFiltersInput;
  sort: string;
  priceRange: PriceRangeInput;
} {
  const parse = (k: string) =>
    sp[k] ? String(sp[k]).split(",").filter(Boolean) : [];

  const filters: FeedFiltersInput = {
    city: parse("city"),
    occasion: parse("occasion"),
    style: parse("style"),
    category: parse("category"),
    price: parse("price"),
    color: parse("color"),
    size: parse("size"),
    brand: parse("brand"),
  };
  const sortRaw = sp.sort ? String(sp.sort) : "relevant";
  const sort = FEED_SORTS.has(sortRaw) ? sortRaw : "relevant";
  const int = (k: string) => {
    const n = Number(String(sp[k] ?? "").replace(/\D/g, ""));
    return sp[k] != null && String(sp[k]).trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.min(n, 100_000_000) : null;
  };
  let min = int("pmin");
  let max = int("pmax");
  if (min != null && max != null && min > max) [min, max] = [max, min];
  return { filters, sort, priceRange: { min, max } };
}

export type FeedPage = {
  items: FeedItem[];
  nextOffset: number | null;
  error: string | null;
  /** Spec 003: el orden vino del perfil de gusto (para atribuir impresiones). */
  personalized: boolean;
  /** Spec 003: instante fijo del orden personalizado; se reenvía en cada tanda (paginación estable). */
  asOf: string | null;
};

function filterArgs(filters: FeedFiltersInput, price: PriceRangeInput = { min: null, max: null }) {
  const arr = (v: string[]) => (v.length ? v : undefined);
  return {
    p_cities: arr(filters.city),
    p_occasions: arr(filters.occasion),
    p_styles: arr(filters.style),
    p_categories: arr(filters.category),
    p_prices: arr(filters.price),
    p_colors: arr(filters.color),
    p_sizes: arr(filters.size),
    p_brands: arr(filters.brand),
    p_price_min: price.min ?? undefined,
    p_price_max: price.max ?? undefined,
  };
}

export function hasActiveFilters(filters: FeedFiltersInput, price?: PriceRangeInput): boolean {
  return Object.values(filters).some((v) => v.length > 0) || price?.min != null || price?.max != null;
}

// Pide una página del feed. Con sesión y orden "Relevante" usa el orden personalizado
// (`get_feed_for_me`, spec 003); si no, `get_feed`.
export async function getFeedPage(
  filters: FeedFiltersInput,
  sort: string,
  offset = 0,
  limit = FEED_PAGE_SIZE,
  opts: { price?: PriceRangeInput; asOf?: string | null; signedIn?: boolean } = {},
): Promise<FeedPage> {
  const supabase = await createClient();
  const args = filterArgs(filters, opts.price);

  if (opts.signedIn && sort === "relevant") {
    const asOf = opts.asOf && !Number.isNaN(Date.parse(opts.asOf)) ? opts.asOf : new Date().toISOString();
    const { data, error } = await supabase.rpc("get_feed_for_me", { ...args, p_limit: limit, p_offset: offset, p_as_of: asOf });
    if (!error) {
      const rows = data ?? [];
      const personalized = rows.some((r) => r.personalized);
      // `personalized` no es parte de FeedItem: se quita de cada fila.
      const items = rows.map((r) => {
        const item: Partial<typeof r> = { ...r };
        delete item.personalized;
        return item;
      }) as FeedItem[];
      return { items, nextOffset: items.length === limit ? offset + limit : null, error: null, personalized, asOf };
    }
    // Si falla, el feed general sigue funcionando.
    console.error("[feed] get_feed_for_me falló:", error.message);
  }

  const { data, error } = await supabase.rpc("get_feed", { ...args, p_sort: sort, p_limit: limit, p_offset: offset });
  if (error) {
    console.error("[feed] get_feed falló:", error.message);
    return { items: [], nextOffset: null, error: error.message, personalized: false, asOf: null };
  }
  const items = data ?? [];
  return { items, nextOffset: items.length === limit ? offset + limit : null, error: null, personalized: false, asOf: null };
}

export type FacetGroup = "city" | "occasion" | "style" | "category" | "price" | "color" | "size" | "brand";
export type FeedFacets = Partial<Record<FacetGroup, Record<string, number>>>;

/** Contadores por opción de filtro (spec 003, FR-022): cada grupo cuenta sin su propio filtro. */
export async function getFeedFacets(filters: FeedFiltersInput, price?: PriceRangeInput): Promise<FeedFacets> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("feed_facets", filterArgs(filters, price));
  if (error) {
    console.error("[feed] feed_facets falló:", error.message);
    return {};
  }
  const out: FeedFacets = {};
  for (const r of data ?? []) ((out[r.grp as FacetGroup] ??= {})[r.value] = r.n);
  return out;
}
