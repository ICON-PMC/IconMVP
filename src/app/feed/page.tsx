import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { Aurora } from "@/components/aurora";
import { FeedFilters } from "@/components/feed-filters";
import { PostCard } from "@/components/post-card";
import { PRICE_BUCKETS } from "@/lib/taxonomy";
import { getMySavedIds } from "@/lib/saves";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const parse = (k: string) =>
    sp[k] ? String(sp[k]).split(",").filter(Boolean) : [];

  const f = {
    category: parse("category"),
    occasion: parse("occasion"),
    style: parse("style"),
    city: parse("city"),
    price: parse("price"),
  };

  const supabase = await createClient();

  // Búsqueda por texto. Se sanea para no romper la sintaxis de filtros de PostgREST.
  const q = (sp.q ? String(sp.q) : "").trim();
  const term = q.replace(/[,()*%]/g, " ").trim();

  // Los títulos de prenda no están en la vista post_feed: se resuelven aparte
  // (prendas que coinciden → posts que las incluyen).
  let matchedPostIds: string[] = [];
  if (term) {
    const { data: gm } = await supabase
      .from("garments")
      .select("id")
      .ilike("title", `%${term}%`)
      .limit(200);
    const gIds = (gm ?? []).map((g) => g.id);
    if (gIds.length) {
      const { data: pim } = await supabase
        .from("post_items")
        .select("post_id")
        .in("garment_id", gIds);
      matchedPostIds = [...new Set((pim ?? []).map((p) => p.post_id))];
    }
  }

  let query = supabase.from("post_feed").select("*");
  if (f.city.length) query = query.in("city_slug", f.city);
  if (f.occasion.length) query = query.overlaps("occasions", f.occasion);
  if (f.style.length) query = query.overlaps("styles", f.style);
  if (f.category.length) query = query.overlaps("categories", f.category);
  if (f.price.length) query = query.overlaps("price_ranges", f.price);
  if (term) {
    const ors = [`caption.ilike.*${term}*`, `brand_name.ilike.*${term}*`];
    if (matchedPostIds.length) ors.push(`id.in.(${matchedPostIds.join(",")})`);
    query = query.or(ors.join(","));
  }
  const feedQuery = query.order("score", { ascending: false });

  const [feedRes, catsRes, occsRes, stylesRes, citiesRes] = await Promise.all([
    feedQuery,
    supabase.from("tags").select("slug, name").eq("type", "category").order("name"),
    supabase.from("tags").select("slug, name").eq("type", "occasion").order("name"),
    supabase.from("tags").select("slug, name").eq("type", "style").order("name"),
    supabase.from("cities").select("slug, name").order("name"),
  ]);

  const toOpts = (rows: { slug: string; name: string }[] | null) =>
    (rows ?? []).map((r) => ({ value: r.slug, label: r.name }));

  const groups = [
    { param: "occasion", label: "Ocasión", options: toOpts(occsRes.data) },
    { param: "city", label: "Ciudad", options: toOpts(citiesRes.data) },
    {
      param: "price",
      label: "Precio",
      options: PRICE_BUCKETS.map((b) => ({ value: b.value, label: b.label })),
    },
    { param: "category", label: "Categoría", options: toOpts(catsRes.data) },
    { param: "style", label: "Estilo", options: toOpts(stylesRes.data) },
  ];

  const posts = feedRes.data ?? [];
  const saved = await getMySavedIds();

  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <SiteHeader />

        <h1 className="mt-8 mb-4 text-3xl font-medium tracking-tight text-forest">
          Explorar
        </h1>

        <div className="mb-6">
          <FeedFilters groups={groups} />
        </div>

        {feedRes.error ? (
          <p className="text-sm text-coral">{feedRes.error.message}</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-ink/60">
            {q
              ? `No encontramos resultados para «${q}». Prueba con otro término o quita filtros.`
              : "No hay posts con esos filtros. Prueba quitar alguno."}
          </p>
        ) : (
          <div className="columns-2 gap-4 md:columns-3">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                saved={saved.posts.has(post.id)}
                path="/feed"
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
