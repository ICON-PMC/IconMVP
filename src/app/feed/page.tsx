import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { Aurora } from "@/components/aurora";
import { FeedFilters } from "@/components/feed-filters";
import { PostCard } from "@/components/post-card";
import { GarmentCard } from "@/components/garment-card";
import { BrandCard } from "@/components/brand-card";
import { PRICE_BUCKETS } from "@/lib/taxonomy";
import { getMySavedIds } from "@/lib/saves";
import { getMyLikedPostIds } from "@/lib/social";
import { getCurrentUser } from "@/lib/auth";
import type { Views } from "@/lib/database.types";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
type Group = { param: string; label: string; options: { value: string; label: string }[] };

const SORTS = new Set(["relevant", "new", "popular", "az"]);
const TYPES = new Set(["garments", "posts", "brands"]);

type PostMeta = { sim: number; same_city: boolean };

function sortPosts(rows: Views<"post_feed">[], sort: string, meta: Map<string, PostMeta>) {
  rows.sort((a, b) => {
    if (sort === "az") return a.brand_name.localeCompare(b.brand_name);
    if (sort === "new") return (b.published_at ?? "").localeCompare(a.published_at ?? "");
    if (sort === "popular") return (b.popularity ?? 0) - (a.popularity ?? 0);
    const ca = meta.get(a.id)?.same_city ? 1 : 0;
    const cb = meta.get(b.id)?.same_city ? 1 : 0;
    if (cb !== ca) return cb - ca;
    return (meta.get(b.id)?.sim ?? 0) - (meta.get(a.id)?.sim ?? 0);
  });
}

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
  const typeRaw = sp.type ? String(sp.type) : "garments";
  const type = TYPES.has(typeRaw) ? typeRaw : "garments";

  const supabase = await createClient();

  const [catsRes, occsRes, stylesRes, citiesRes] = await Promise.all([
    supabase.from("tags").select("slug, name").eq("type", "category").order("name"),
    supabase.from("tags").select("slug, name").eq("type", "occasion").order("name"),
    supabase.from("tags").select("slug, name").eq("type", "style").order("name"),
    supabase.from("cities").select("slug, name").order("name"),
  ]);
  const toOpts = (rows: { slug: string; name: string }[] | null) =>
    (rows ?? []).map((r) => ({ value: r.slug, label: r.name }));

  const cityGroup: Group = { param: "city", label: "Ciudad", options: toOpts(citiesRes.data) };
  const priceGroup: Group = {
    param: "price",
    label: "Precio",
    options: PRICE_BUCKETS.map((b) => ({ value: b.value, label: b.label })),
  };
  const categoryGroup: Group = { param: "category", label: "Categoría", options: toOpts(catsRes.data) };
  const occasionGroup: Group = { param: "occasion", label: "Ocasión", options: toOpts(occsRes.data) };
  const styleGroup: Group = { param: "style", label: "Estilo", options: toOpts(stylesRes.data) };

  const [saved, liked, session] = await Promise.all([
    getMySavedIds(),
    getMyLikedPostIds(),
    getCurrentUser(),
  ]);
  const isLoggedIn = Boolean(session?.profile);

  // ===================== Modo búsqueda: pestañas Prendas / Outfits / Marcas =====================
  if (q) {
    const userCity = session?.profile?.home_city_id ?? undefined;

    // Contadores por tipo (solo por texto, sin filtros).
    const [gCount, pCount, bCount] = await Promise.all([
      supabase.rpc("search_garments", { q }),
      supabase.rpc("search_posts", { q }),
      supabase.rpc("search_brands", { q }),
    ]);
    const counts = {
      garments: gCount.data?.length ?? 0,
      posts: pCount.data?.length ?? 0,
      brands: bCount.data?.length ?? 0,
    };

    const tabHref = (t: string) => {
      const params = new URLSearchParams();
      params.set("q", q);
      if (sort !== "relevant") params.set("sort", sort);
      if (t !== "garments") params.set("type", t);
      return `/feed?${params}`;
    };
    const TAB_LABELS: [string, string][] = [
      ["garments", "Prendas"],
      ["posts", "Outfits"],
      ["brands", "Marcas"],
    ];
    const tabs = (
      <div className="mb-5 flex flex-wrap gap-2">
        {TAB_LABELS.map(([t, label]) => (
          <Link
            key={t}
            href={tabHref(t)}
            className={
              t === type
                ? "rounded-full bg-forest px-4 py-1.5 text-sm font-medium text-white"
                : "glass-input rounded-full px-4 py-1.5 text-sm text-ink/80 hover:bg-white/70"
            }
          >
            {label}{" "}
            <span className={t === type ? "text-white/70" : "text-ink/40"}>
              {counts[t as keyof typeof counts]}
            </span>
          </Link>
        ))}
      </div>
    );

    let groups: Group[] = [];
    let body: React.ReactNode;

    if (type === "brands") {
      const { data, error } = await supabase.rpc("search_brands", { q, p_user_city: userCity });
      const rows = [...(data ?? [])].sort((a, b) => {
        if (sort === "az") return a.name.localeCompare(b.name);
        if (sort === "new") return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        if (sort === "popular") return b.garments - a.garments;
        const ca = a.same_city ? 1 : 0;
        const cb = b.same_city ? 1 : 0;
        if (cb !== ca) return cb - ca;
        return b.sim - a.sim;
      });
      body = error ? (
        <p className="text-sm text-coral">{error.message}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink/60">No encontramos marcas para «{q}».</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
            <BrandCard
              key={b.id}
              slug={b.slug}
              name={b.name}
              bio={b.bio}
              cityName={b.city_name}
              isVerified={b.is_verified}
              isSustainable={b.is_sustainable}
              garments={b.garments}
            />
          ))}
        </div>
      );
    } else if (type === "posts") {
      groups = [occasionGroup, cityGroup, priceGroup, categoryGroup, styleGroup];
      const { data: matches } = await supabase.rpc("search_posts", { q, p_user_city: userCity });
      const ids = (matches ?? []).map((m) => m.id);
      const meta = new Map<string, PostMeta>(
        (matches ?? []).map((m) => [m.id, { sim: m.sim, same_city: m.same_city }]),
      );
      let rows: Views<"post_feed">[] = [];
      if (ids.length) {
        let pq = supabase.from("post_feed").select("*").in("id", ids);
        if (f.city.length) pq = pq.in("city_slug", f.city);
        if (f.occasion.length) pq = pq.overlaps("occasions", f.occasion);
        if (f.style.length) pq = pq.overlaps("styles", f.style);
        if (f.category.length) pq = pq.overlaps("categories", f.category);
        if (f.price.length) pq = pq.overlaps("price_ranges", f.price);
        rows = (await pq).data ?? [];
        sortPosts(rows, sort, meta);
      }
      body =
        rows.length === 0 ? (
          <p className="text-sm text-ink/60">
            No encontramos outfits para «{q}». Prueba con otro término o quita filtros.
          </p>
        ) : (
          <div className="columns-2 gap-4 md:columns-3">
            {rows.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                saved={saved.posts.has(post.id)}
                liked={liked.has(post.id)}
                isLoggedIn={isLoggedIn}
                path="/feed"
              />
            ))}
          </div>
        );
    } else {
      // garments (default)
      groups = [cityGroup, priceGroup, categoryGroup];
      const { data, error } = await supabase.rpc("search_garments", {
        q,
        p_cities: f.city.length ? f.city : undefined,
        p_categories: f.category.length ? f.category : undefined,
        p_prices: f.price.length ? f.price : undefined,
        p_sort: sort,
        p_user_city: userCity,
      });
      const items = data ?? [];
      body = error ? (
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
      );
    }

    return (
      <Shell groups={groups} sort={sort}>
        {tabs}
        {body}
      </Shell>
    );
  }

  // ===================== Modo browse: feed de POSTS (outfits) =====================
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

  const groups = [occasionGroup, cityGroup, priceGroup, categoryGroup, styleGroup];

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
              liked={liked.has(post.id)}
              isLoggedIn={isLoggedIn}
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
  groups: Group[];
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
