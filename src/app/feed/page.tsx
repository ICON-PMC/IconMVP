import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { Aurora } from "@/components/aurora";
import { FeedTopBar } from "@/components/feed/top-bar";
import { FeedActiveChips } from "@/components/feed/active-chips";
import { FeedSuggestions } from "@/components/feed/suggestions";
import { FeedGrid } from "@/components/feed-grid";
import { FeedCard } from "@/components/feed-card";
import { BrandCard } from "@/components/brand-card";
import { PRICE_BUCKETS } from "@/lib/taxonomy";
import { getMySavedIds } from "@/lib/saves";
import { getMyLikedPostIds } from "@/lib/social";
import { getCurrentUser } from "@/lib/auth";
import { getSuggestionChips } from "@/lib/suggestions";
import { parseFeedParams, getFeedPage, type FeedItem } from "@/lib/feed";
import type { FilterGroup } from "@/components/feed/filter-panel";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const TYPES = new Set(["all", "garments", "posts", "brands"]);

type Meta = { sim: number; same_city: boolean };

function sortFeedItems(items: FeedItem[], sort: string, meta: Map<string, Meta>) {
  items.sort((a, b) => {
    if (sort === "az") return a.brand_name.localeCompare(b.brand_name);
    if (sort === "new") return (b.published_at ?? "").localeCompare(a.published_at ?? "");
    if (sort === "popular") return (b.popularity ?? 0) - (a.popularity ?? 0);
    const key = (it: FeedItem) => `${it.kind}:${it.id}`;
    const ca = meta.get(key(a))?.same_city ? 1 : 0;
    const cb = meta.get(key(b))?.same_city ? 1 : 0;
    if (cb !== ca) return cb - ca;
    return (meta.get(key(b))?.sim ?? 0) - (meta.get(key(a))?.sim ?? 0);
  });
}

// Trae de `feed_items` las filas de un `kind` cuyo id está en `ids`, con los filtros
// activos aplicados (para las pestañas de búsqueda "Todo" / "Outfits").
async function fetchFeedItemsByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: "post" | "garment",
  ids: string[],
  f: { city: string[]; occasion: string[]; style: string[]; category: string[]; price: string[] },
): Promise<FeedItem[]> {
  if (ids.length === 0) return [];
  let q = supabase.from("feed_items").select("*").eq("kind", kind).in("id", ids);
  if (f.city.length) q = q.in("city_slug", f.city);
  if (f.occasion.length) q = q.overlaps("occasions", f.occasion);
  if (f.style.length) q = q.overlaps("styles", f.style);
  if (f.category.length) q = q.overlaps("categories", f.category);
  if (f.price.length) q = q.overlaps("price_ranges", f.price);
  const { data } = await q;
  return data ?? [];
}

export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { filters: f, sort } = parseFeedParams(sp);
  const q = (sp.q ? String(sp.q) : "").trim();
  const typeRaw = sp.type ? String(sp.type) : "all";
  const type = TYPES.has(typeRaw) ? typeRaw : "all";

  const supabase = await createClient();

  const [catsRes, occsRes, stylesRes, citiesRes] = await Promise.all([
    supabase.from("tags").select("slug, name").eq("type", "category").order("name"),
    supabase.from("tags").select("slug, name").eq("type", "occasion").order("name"),
    supabase.from("tags").select("slug, name").eq("type", "style").order("name"),
    supabase.from("cities").select("slug, name").order("name"),
  ]);
  const toOpts = (rows: { slug: string; name: string }[] | null) =>
    (rows ?? []).map((r) => ({ value: r.slug, label: r.name }));

  const cityGroup: FilterGroup = { param: "city", label: "Ciudad", options: toOpts(citiesRes.data) };
  const priceGroup: FilterGroup = {
    param: "price",
    label: "Precio",
    options: PRICE_BUCKETS.map((b) => ({ value: b.value, label: b.label })),
  };
  const categoryGroup: FilterGroup = { param: "category", label: "Categoría", options: toOpts(catsRes.data) };
  const occasionGroup: FilterGroup = { param: "occasion", label: "Ocasión", options: toOpts(occsRes.data) };
  const styleGroup: FilterGroup = { param: "style", label: "Estilo", options: toOpts(stylesRes.data) };
  const allGroups = [occasionGroup, cityGroup, priceGroup, categoryGroup, styleGroup];

  const tagNames: Record<string, string> = {};
  for (const t of [...(occsRes.data ?? []), ...(stylesRes.data ?? [])]) tagNames[t.slug] = t.name;

  // Una sola tanda: la sesión se reusa en los dos modos y en los FeedCard.
  const [saved, liked, session] = await Promise.all([
    getMySavedIds(),
    getMyLikedPostIds(),
    getCurrentUser(),
  ]);
  const isLoggedIn = Boolean(session?.profile);

  // ===================== Modo búsqueda: pestañas Todo / Prendas / Outfits / Marcas =====================
  if (q) {
    const userCity = session?.profile?.home_city_id ?? undefined;

    // Contadores por tipo (solo por texto, sin filtros); se reusan como fuente de datos
    // de las pestañas "Todo" y "Outfits" para no repetir la búsqueda.
    const [gCount, pCount, bCount] = await Promise.all([
      supabase.rpc("search_garments", { q }),
      supabase.rpc("search_posts", { q }),
      supabase.rpc("search_brands", { q }),
    ]);
    const counts = {
      all: (gCount.data?.length ?? 0) + (pCount.data?.length ?? 0),
      garments: gCount.data?.length ?? 0,
      posts: pCount.data?.length ?? 0,
      brands: bCount.data?.length ?? 0,
    };

    const tabHref = (t: string) => {
      const params = new URLSearchParams();
      params.set("q", q);
      if (sort !== "relevant") params.set("sort", sort);
      if (t !== "all") params.set("type", t);
      return `/feed?${params}`;
    };
    const TAB_LABELS: [string, string][] = [
      ["all", "Todo"],
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

    let groups: FilterGroup[] = [];
    let body: React.ReactNode;
    const clearFiltersHref = (() => {
      const params = new URLSearchParams();
      params.set("q", q);
      if (sort !== "relevant") params.set("sort", sort);
      if (type !== "all") params.set("type", type);
      return `/feed?${params}`;
    })();

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
      if (error) console.error("[feed] search_brands falló:", error.message);
      body = error ? (
        <p className="text-sm text-ink/60">
          No pudimos cargar marcas en este momento. Intenta de nuevo.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState text={`No encontramos marcas para «${q}».`} />
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
      groups = allGroups;
      const matches = pCount.data ?? [];
      const meta = new Map<string, Meta>(
        matches.map((m) => [`post:${m.id}`, { sim: m.sim, same_city: m.same_city }]),
      );
      const rows = await fetchFeedItemsByIds(
        supabase,
        "post",
        matches.map((m) => m.id),
        f,
      );
      sortFeedItems(rows, sort, meta);
      body =
        rows.length === 0 ? (
          <EmptyState text={`No encontramos outfits para «${q}». Prueba con otro término o quita filtros.`} clearHref={clearFiltersHref} />
        ) : (
          <div className="columns-2 gap-4 md:columns-3">
            {rows.map((item) => (
              <FeedCard
                key={`${item.kind}:${item.id}`}
                item={item}
                tagNames={tagNames}
                saved={saved.posts.has(item.id)}
                liked={liked.has(item.id)}
                isLoggedIn={isLoggedIn}
                path="/feed"
              />
            ))}
          </div>
        );
    } else if (type === "garments") {
      groups = [cityGroup, priceGroup, categoryGroup];
      const matches = gCount.data ?? [];
      const meta = new Map<string, Meta>(
        matches.map((m) => [`garment:${m.id}`, { sim: m.sim, same_city: false }]),
      );
      const rows = await fetchFeedItemsByIds(
        supabase,
        "garment",
        matches.map((m) => m.id),
        f,
      );
      sortFeedItems(rows, sort, meta);
      body =
        rows.length === 0 ? (
          <EmptyState text={`No encontramos prendas para «${q}». Prueba con otro término o quita filtros.`} clearHref={clearFiltersHref} />
        ) : (
          <div className="columns-2 gap-4 md:columns-3">
            {rows.map((item) => (
              <FeedCard
                key={`${item.kind}:${item.id}`}
                item={item}
                tagNames={tagNames}
                saved={saved.garments.has(item.id)}
                liked={liked.has(item.id)}
                isLoggedIn={isLoggedIn}
                path="/feed"
              />
            ))}
          </div>
        );
    } else {
      // "all" (Todo, por defecto): mezcla prendas + outfits ya encontrados para los contadores.
      groups = allGroups;
      const meta = new Map<string, Meta>([
        ...(gCount.data ?? []).map((m) => [`garment:${m.id}`, { sim: m.sim, same_city: false }] as const),
        ...(pCount.data ?? []).map((m) => [`post:${m.id}`, { sim: m.sim, same_city: m.same_city }] as const),
      ]);
      const [gRows, pRows] = await Promise.all([
        fetchFeedItemsByIds(supabase, "garment", (gCount.data ?? []).map((m) => m.id), f),
        fetchFeedItemsByIds(supabase, "post", (pCount.data ?? []).map((m) => m.id), f),
      ]);
      const rows = [...gRows, ...pRows];
      sortFeedItems(rows, sort, meta);
      body =
        rows.length === 0 ? (
          <EmptyState text={`No encontramos nada para «${q}». Prueba con otro término o quita filtros.`} clearHref={clearFiltersHref} />
        ) : (
          <div className="columns-2 gap-4 md:columns-3">
            {rows.map((item) => (
              <FeedCard
                key={`${item.kind}:${item.id}`}
                item={item}
                tagNames={tagNames}
                saved={item.kind === "post" ? saved.posts.has(item.id) : saved.garments.has(item.id)}
                liked={liked.has(item.id)}
                isLoggedIn={isLoggedIn}
                path="/feed"
              />
            ))}
          </div>
        );
    }

    return (
      <Shell groups={groups} sort={sort} suggestions={null}>
        {tabs}
        {body}
      </Shell>
    );
  }

  // ===================== Modo browse: feed mixto (outfits + prendas) =====================
  const [{ items, nextOffset, error }, chips] = await Promise.all([
    getFeedPage(f, sort),
    getSuggestionChips(),
  ]);

  return (
    <Shell groups={allGroups} sort={sort} suggestions={chips}>
      {error ? (
        <p className="glass rounded-2xl px-6 py-16 text-center text-sm text-ink/60">
          No pudimos cargar el feed en este momento. Intenta de nuevo en un momento.
        </p>
      ) : (
        <FeedGrid
          key={JSON.stringify({ f, sort })}
          initialItems={items}
          initialNextOffset={nextOffset}
          initialSaved={saved}
          initialLiked={liked}
          isLoggedIn={isLoggedIn}
          tagNames={tagNames}
        />
      )}
    </Shell>
  );
}

function EmptyState({ text, clearHref = "/feed" }: { text: string; clearHref?: string }) {
  return (
    <div className="glass rounded-2xl px-6 py-16 text-center">
      <p className="text-sm text-ink/60">{text}</p>
      <Link href={clearHref} className="mt-3 inline-block text-sm font-medium text-coral hover:underline">
        Limpiar filtros
      </Link>
    </div>
  );
}

function Shell({
  groups,
  sort,
  suggestions,
  children,
}: {
  groups: FilterGroup[];
  sort: string;
  suggestions: Awaited<ReturnType<typeof getSuggestionChips>> | null;
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
        <div className="mb-4">
          <FeedTopBar groups={groups} sort={sort} />
        </div>
        {suggestions && suggestions.length > 0 && <FeedSuggestions chips={suggestions} />}
        <FeedActiveChips groups={groups} />
        {children}
      </div>
    </>
  );
}
