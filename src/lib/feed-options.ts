import { unstable_cache } from "next/cache";
import { getCityFilterOptions, type CityOption } from "@/lib/cities";
import { createPublicClient } from "@/lib/supabase/public";

export type TagRow = { slug: string; name: string };
export type ColorRow = { slug: string; name: string; hex: string | null };

export type FeedOptions = {
  categories: TagRow[];
  occasions: TagRow[];
  /** Estilos visibles con contenido publicado, por nombre. */
  styles: TagRow[];
  cities: CityOption[];
  colors: ColorRow[];
  /** Slugs de estilos de más a menos usados en el contenido publicado. */
  popularStyles: string[];
};

async function loadFeedOptions(): Promise<FeedOptions> {
  // Regla (spec 006, FR-018): aquí solo el cliente público. Nada con la sesión de una persona.
  const supabase = createPublicClient();
  const [cats, occs, styles, cities, colors, styleUse] = await Promise.all([
    supabase.from("tags").select("slug, name").eq("type", "category").order("name"),
    supabase.from("tags").select("slug, name").eq("type", "occasion").order("name"),
    supabase.from("tags").select("slug, name").eq("type", "style").eq("is_hidden", false).order("name"),
    getCityFilterOptions(supabase),
    supabase.rpc("color_filter_options"),
    supabase.rpc("feed_style_counts"),
  ]);
  // Un error no se guarda en la caché: se lanza y la página muestra los filtros vacíos.
  for (const r of [cats, occs, styles, colors, styleUse])
    if (r.error) throw new Error(`[feed-options] ${r.error.message}`);

  const used = new Set((styleUse.data ?? []).map((s) => s.slug));
  return {
    categories: cats.data ?? [],
    occasions: occs.data ?? [],
    styles: (styles.data ?? []).filter((t) => used.has(t.slug)),
    cities,
    colors: (colors.data ?? []).map((c) => ({ slug: c.slug, name: c.name, hex: c.hex })),
    popularStyles: (styleUse.data ?? []).map((s) => s.slug),
  };
}

/**
 * Opciones de los filtros de /feed, compartidas entre visitantes y renovadas cada 60 s (spec 006,
 * FR-015/016). Son datos públicos; el contenido retirado no depende de esta caché (los resultados del
 * feed y las fichas se leen siempre en vivo).
 */
export const getFeedOptions = unstable_cache(loadFeedOptions, ["feed-options-v1"], { revalidate: 60 });

export const EMPTY_FEED_OPTIONS: FeedOptions = {
  categories: [],
  occasions: [],
  styles: [],
  cities: [],
  colors: [],
  popularStyles: [],
};
