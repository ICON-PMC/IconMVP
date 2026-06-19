import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { Aurora } from "@/components/aurora";
import { FeedFilters } from "@/components/feed-filters";
import { PostCard } from "@/components/post-card";
import { GarmentCard } from "@/components/garment-card";
import { PRICE_BUCKETS } from "@/lib/taxonomy";
import { getMySavedIds } from "@/lib/saves";
import { getCurrentUser } from "@/lib/auth";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const SORTS = new Set(["relevant", "new", "popular", "az"]);

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
  const q = (sp.q ? String(sp.q) : "").trim();
  const sortRaw = sp.sort ? String(sp.sort) : "relevant";
  const sort = SORTS.has(sortRaw) ? sortRaw : "relevant";

  const supabase = await createClient();

  // Opciones de filtros (taxonomía).
  const [catsRes, occsRes, stylesRes, citiesRes] = await Promise.all([
    supabase.from("tags").select("slug, name").eq("type", "category").order("name"),
    supabase.from("tags").select("slug, name").eq("type", "occasion").order("name"),
    supabase.from("tags").select("slug, name").eq("type", "style").order("name"),
    supabase.from("cities").select("slug, name").order("name"),
  ]);
  const toOpts = (rows: { slug: string; name: string }[] | null) =>
    (rows ?? []).map((r) => ({ value: r.slug, label: r.name }));

  const cityGroup = { param: "city", label: "Ciudad", options: toOpts(citiesRes.data) };
  const priceGroup = {
    param: "price",
    label: "Precio",
    options: PRICE_BUCKETS.map((b) => ({ value: b.value, label: b.label })),
  };
  const categoryGroup = { param: "category", label: "Categoría", options: toOpts(catsRes.data) };

  const saved = await getMySavedIds();

  // ---- Modo búsqueda: resultados de PRENDAS ----
  if (q) {
    const session = await getCurrentUser();
    const { data: garments, error } = await supabase.rpc("search_garments", {
      q,
      p_cities: f.city.length ? f.city : undefined,
      p_categories: f.category.length ? f.category : undefined,
      p_prices: f.price.length ? f.price : undefined,
      p_sort: sort,
      p_user_city: session?.profile?.home_city_id ?? undefined,
    });
    const items = garments ?? [];

    // En búsqueda de prendas solo aplican filtros de prenda.
    const groups = [cityGroup, priceGroup, categoryGroup];

    return (
      <Shell groups={groups} sort={sort}>
        {error ? (
          <p className="text-sm text-coral">{error.message}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink/60">
            No encontramos prendas para «{q}». Prueba con otro término o quita filtros.
          </p>
        ) : (
          <div className="columns-2 gap-4 md:columns-3">
            {items.map((g) => (
              <div key={g.id} className="mb-4 break-inside-avoid">
                <GarmentCard
                  id={g.id}
                  title={g.title}
                  price_cop={g.price_cop}
                  image={g.image}
                  saved={saved.garments.has(g.id)}
                  path="/feed"
                />
              </div>
            ))}
          </div>
        )}
      </Shell>
    );
  }

  // ---- Modo browse: feed de POSTS (outfits) ----
  let query = supabase.from("post_feed").select("*");
  if (f.city.length) query = query.in("city_slug", f.city);
  if (f.occasion.length) query = query.overlaps("occasions", f.occasion);
  if (f.style.length) query = query.overlaps("styles", f.style);
  if (f.category.length) query = query.overlaps("categories", f.category);
  if (f.price.length) query = query.overlaps("price_ranges", f.price);
  if (sort === "new") query = query.order("published_at", { ascending: false });
  else if (sort === "popular") query = query.order("popularity", { ascending: false });
  else if (sort === "az") query = query.order("brand_name", { ascending: true });
  else query = query.order("score", { ascending: false });

  const feedRes = await query;
  const posts = feedRes.data ?? [];

  const groups = [
    { param: "occasion", label: "Ocasión", options: toOpts(occsRes.data) },
    cityGroup,
    priceGroup,
    categoryGroup,
    { param: "style", label: "Estilo", options: toOpts(stylesRes.data) },
  ];

  return (
    <Shell groups={groups} sort={sort}>
      {feedRes.error ? (
        <p className="text-sm text-coral">{feedRes.error.message}</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-ink/60">
          No hay posts con esos filtros. Prueba quitar alguno.
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
    </Shell>
  );
}

function Shell({
  groups,
  sort,
  children,
}: {
  groups: { param: string; label: string; options: { value: string; label: string }[] }[];
  sort: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <SiteHeader />
        <h1 className="mt-8 mb-4 text-3xl font-medium tracking-tight text-forest">
          Explorar
        </h1>
        <div className="mb-6">
          <FeedFilters groups={groups} sort={sort} />
        </div>
        {children}
      </div>
    </>
  );
}
