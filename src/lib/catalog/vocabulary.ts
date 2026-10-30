// Vocabulario de Icon (categorías, tallas, marcas, estilos, ocasiones, climas) que usa el Excel de
// carga masiva. Se lee de la base para que el Excel use EXACTAMENTE los nombres que acepta el importador.
// Compartido por el CLI (lectura por REST con la anon key) y el panel (cliente de Supabase de la sesión).
// Módulo sin dependencias de Next.
import type { SupabaseClient } from "@supabase/supabase-js";

export type TagOption = { name: string; slug: string };

export type Vocabulary = {
  categories: string[];
  styles: TagOption[];
  occasions: TagOption[];
  climates: TagOption[];
  sizes: { label: string; aliases: string[] }[];
  brands: string[];
  source: string;
};

// Respaldo (supabase/seed.sql) para cuando no hay conexión a la base.
export const FALLBACK_VOCABULARY: Vocabulary = {
  styles: [
    ["Artesanal", "artesanal"], ["Boho", "boho"], ["Clásico", "clasico"], ["Minimalista", "minimalista"],
    ["Streetwear", "streetwear"], ["Tropical", "tropical"], ["Vintage", "vintage"],
  ].map(([name, slug]) => ({ name, slug })),
  occasions: [
    ["Beachwear", "beachwear"], ["Brunch", "brunch"], ["Casual", "casual"], ["Fiesta", "fiesta"],
    ["Formal", "formal"], ["Trabajo", "trabajo"], ["Viaje", "viaje"], ["Workout", "workout"],
  ].map(([name, slug]) => ({ name, slug })),
  climates: [
    ["Cálido", "calido"], ["Frío", "frio"], ["Templado", "templado"],
  ].map(([name, slug]) => ({ name, slug })),
  categories: [
    "Abrigos y tejidos", "Accesorios", "Blusas", "Bolsos", "Calzado", "Camisas", "Chaquetas",
    "Enterizos y conjuntos", "Faldas", "Jeans", "Pantalones", "Shorts", "Swimwear", "Tops", "Vestidos",
  ],
  sizes: [
    { label: "XXXS", aliases: ["3XS"] }, { label: "XXS", aliases: ["2XS"] }, { label: "XS", aliases: [] },
    { label: "S", aliases: [] }, { label: "M", aliases: [] }, { label: "L", aliases: [] }, { label: "XL", aliases: [] },
    { label: "XXL", aliases: ["2XL"] }, { label: "XXXL", aliases: ["3XL"] },
    { label: "Onesize", aliases: ["os", "unitalla", "talla unica"] }, { label: "Plussize", aliases: ["plus", "curvy"] },
  ],
  brands: [],
  source: "lista de respaldo (supabase/seed.sql), sin conexión a la base",
};

type TagRow = { name: string; slug: string; type: string };
type SizeRow = { label: string; aliases: string[] | null };

function build(tags: TagRow[], sizes: SizeRow[], brands: string[], source: string): Vocabulary {
  const ofType = (t: string) => tags.filter((x) => x.type === t);
  const options = (t: string): TagOption[] => ofType(t).map((x) => ({ name: x.name, slug: x.slug }));
  if (!ofType("category").length || !sizes.length) return FALLBACK_VOCABULARY;
  return {
    categories: ofType("category").map((c) => c.name),
    styles: options("style"),
    occasions: options("occasion"),
    climates: options("temperature"),
    sizes: sizes.map((s) => ({ label: s.label, aliases: s.aliases ?? [] })),
    brands,
    source,
  };
}

// CLI: tablas públicas por REST con la anon key (sin sesión).
export async function loadVocabularyRest(env: { url?: string; anonKey?: string }): Promise<Vocabulary> {
  const url = env.url?.replace(/\/$/, "");
  const key = env.anonKey;
  if (!url || !key) return FALLBACK_VOCABULARY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as T;
  };
  try {
    const [tags, sizes, brands] = await Promise.all([
      get<TagRow[]>("tags?select=name,slug,type&order=name"),
      get<SizeRow[]>("sizes?select=label,aliases&order=sort_order"),
      get<{ name: string }[]>("brands?select=name&order=name"),
    ]);
    return build(tags, sizes, brands.map((b) => b.name), `la base de Icon (${new URL(url).host})`);
  } catch {
    return FALLBACK_VOCABULARY;
  }
}

// Servidor: cliente de Supabase con la sesión del staff (ve todas las marcas, no solo las activas).
export async function loadVocabularyFromSupabase(client: SupabaseClient): Promise<Vocabulary> {
  try {
    const [tags, sizes, brands] = await Promise.all([
      client.from("tags").select("name, slug, type").order("name"),
      client.from("sizes").select("label, aliases").order("sort_order"),
      client.from("brands").select("name").order("name"),
    ]);
    if (tags.error || sizes.error || brands.error) return FALLBACK_VOCABULARY;
    return build(
      (tags.data ?? []) as TagRow[],
      (sizes.data ?? []) as SizeRow[],
      ((brands.data ?? []) as { name: string }[]).map((b) => b.name),
      "la base de Icon",
    );
  } catch {
    return FALLBACK_VOCABULARY;
  }
}
