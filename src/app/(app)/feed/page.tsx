import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FlashToast } from "@/components/flash-toast";
import { getBrandStyleNames } from "@/lib/tags";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_FEED_OPTIONS, getFeedOptions } from "@/lib/feed-options";
import { FeedSkeletonGrid } from "@/components/feed/feed-skeleton";
import { EmptyState as SystemEmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { CloudOffIcon, SearchXIcon } from "lucide-react";
import { FeedTopBar } from "@/components/feed/top-bar";
import { FeedActiveChips } from "@/components/feed/active-chips";
import { FeedSuggestions } from "@/components/feed/suggestions";
import { FeedGrid } from "@/components/feed-grid";
import { FeedCard } from "@/components/feed-card";
import { BrandCard } from "@/components/brand-card";
import { VisualResults } from "@/components/visual/visual-results";
import { PRICE_BUCKETS } from "@/lib/taxonomy";
import { getMySavedIds } from "@/lib/saves";
import { getMyLikedGarmentIds, getMyLikedPostIds } from "@/lib/social";
import { getCurrentUser } from "@/lib/auth";
import { getSuggestionChips } from "@/lib/suggestions";
import { FEED_PAGE_SIZE, feedItemAuthor, parseFeedParams, getFeedPage, type FeedItem } from "@/lib/feed";
import type { FilterGroup } from "@/components/feed/filter-panel";
import { getFollowingFeedPage, getFollowSuggestions } from "@/lib/profile";
import { RATING_MIN_FOR_AVG } from "@/lib/rating-rules";
import { SearchTracker } from "@/components/events/search-tracker";
import { FollowSuggestions } from "@/components/profile/follow-suggestions";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const TYPES = new Set(["all", "garments", "posts", "brands"]);

type Meta = { sim: number; same_city: boolean };

function sortFeedItems(items: FeedItem[], sort: string, meta: Map<string, Meta>) {
  items.sort((a, b) => {
    if (sort === "az") return feedItemAuthor(a).name.localeCompare(feedItemAuthor(b).name, "es");
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
  f: { city: string[]; occasion: string[]; style: string[]; category: string[]; price: string[]; color: string[] },
): Promise<FeedItem[]> {
  if (ids.length === 0) return [];
  let q = supabase.from("feed_items").select("*").eq("kind", kind).in("id", ids);
  if (f.city.length) q = q.in("city_slug", f.city);
  if (f.occasion.length) q = q.overlaps("occasions", f.occasion);
  if (f.style.length) q = q.overlaps("styles", f.style);
  if (f.category.length) q = q.overlaps("categories", f.category);
  if (f.price.length) q = q.overlaps("price_ranges", f.price);
  if (f.color.length) q = q.overlaps("colors", f.color);
  const { data } = await q;
  return data ?? [];
}

// Avisos al llegar al feed después de cerrar una marca o borrar la cuenta.
const FEED_FLASH = {
  "marca-cerrada": "Cerramos la cuenta de tu marca. Tu cuenta de usuario sigue activa.",
  "cuenta-eliminada": "Tu cuenta fue eliminada.",
};

// Hasta este número de ciudades el filtro sigue siendo de chips.
const CITY_CHIPS_MAX = 8;
// Estilos más usados que se muestran como chips cuando hay buscador.
const STYLE_CHIPS = 10;

export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { filters: f, sort } = parseFeedParams(sp);
  const q = (sp.q ? String(sp.q) : "").trim();
  const typeRaw = sp.type ? String(sp.type) : "all";
  const type = TYPES.has(typeRaw) ? typeRaw : "all";

  const supabase = await createClient();

  // Opciones de filtros en caché compartida de 60 s (spec 006); si fallan, el feed funciona sin ellas.
  const options = await getFeedOptions().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    return EMPTY_FEED_OPTIONS;
  });
  const toOpts = (rows: { slug: string; name: string }[] | null) =>
    (rows ?? []).map((r) => ({ value: r.slug, label: r.name }));

  // Solo ciudades con marcas activas; con muchas, el panel muestra un buscador en vez de chips.
  const cityGroup: FilterGroup = {
    param: "city",
    label: "Ciudad",
    options: options.cities,
    searchable: options.cities.length > CITY_CHIPS_MAX,
  };
  const priceGroup: FilterGroup = {
    param: "price",
    label: "Precio",
    options: PRICE_BUCKETS.map((b) => ({ value: b.value, label: b.label })),
  };
  const categoryGroup: FilterGroup = { param: "category", label: "Categoría", options: toOpts(options.categories) };
  const occasionGroup: FilterGroup = { param: "occasion", label: "Ocasión", options: toOpts(options.occasions) };
  // Estilos: solo los que tienen contenido publicado. Vocabulario abierto (spec 004): con muchos,
  // los STYLE_CHIPS más usados van como chips y el resto se encuentra con el buscador.
  const styleOptions = toOpts(options.styles);
  const styleGroup: FilterGroup = {
    param: "style",
    label: "Estilo",
    options: styleOptions,
    searchable: styleOptions.length > STYLE_CHIPS,
    featured: options.popularStyles.slice(0, STYLE_CHIPS),
  };
  const colorGroup: FilterGroup = {
    param: "color",
    label: "Color",
    options: options.colors.map((c) => ({ value: c.slug, label: c.name, swatch: c.hex })),
  };
  const allGroups = [occasionGroup, cityGroup, priceGroup, categoryGroup, styleGroup, colorGroup];

  const tagNames: Record<string, string> = {};
  for (const t of [...options.occasions, ...options.styles]) tagNames[t.slug] = t.name;

  // Una sola tanda: la sesión se reusa en los dos modos y en los FeedCard.
  const [saved, likedPosts, likedGarments, session] = await Promise.all([
    getMySavedIds(),
    getMyLikedPostIds(),
    getMyLikedGarmentIds(),
    getCurrentUser(),
  ]);
  const liked = { posts: likedPosts, garments: likedGarments };
  const isLoggedIn = Boolean(session?.profile);

  // ===================== Vista "Siguiendo" (spec 009, US4) =====================
  // Cronológica, solo marcas y personas que sigo. Sin filtros ni buscador en esta versión.
  if (sp.ver === "siguiendo" && isLoggedIn) {
    return (
      <Shell isLoggedIn={isLoggedIn} groups={[]} sort={sort} suggestions={null} view="siguiendo">
        <Suspense fallback={<FeedSkeletonGrid />}>
          <FollowingResults saved={saved} liked={liked} tagNames={tagNames} />
        </Suspense>
      </Shell>
    );
  }

  // ===================== Modo búsqueda por foto (spec 005) =====================
  // La foto vive en el navegador (sessionStorage); aquí solo van los filtros aplicables a prendas.
  if (sp.visual === "1") {
    if (!isLoggedIn) redirect(`/login?aviso=${encodeURIComponent("Inicia sesión para buscar por foto.")}`);
    return (
      <Shell isLoggedIn={isLoggedIn}
        groups={[occasionGroup, cityGroup, priceGroup, categoryGroup, styleGroup, colorGroup]}
        sort={sort}
        suggestions={null}
      >
        <Suspense>
          <VisualResults
            tagNames={tagNames}
            savedGarments={[...saved.garments]}
            likedGarments={[...liked.garments]}
          />
        </Suspense>
      </Shell>
    );
  }

  // ===================== "Más como esta" completo (spec 005, US4) =====================
  if (typeof sp.similar === "string" && /^[0-9a-f-]{36}$/i.test(sp.similar)) {
    const { data: hits } = await supabase.rpc("similar_garments", {
      p_garment_id: sp.similar,
      p_limit: 48,
      p_min: 0,
    });
    const order = new Map((hits ?? []).map((h, i) => [h.id, i]));
    const rows = (
      await fetchFeedItemsByIds(supabase, "garment", (hits ?? []).map((h) => h.id), f)
    ).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return (
      <Shell isLoggedIn={isLoggedIn}
        groups={[occasionGroup, cityGroup, priceGroup, categoryGroup, styleGroup, colorGroup]}
        sort={sort}
        suggestions={null}
      >
        <p className="mb-4 text-sm text-text-muted">
          Prendas parecidas a la que estabas viendo.{" "}
          <Link href={`/prenda/${sp.similar}`} className="font-medium text-coral hover:underline">
            Volver a la prenda
          </Link>
        </p>
        {rows.length === 0 ? (
          <EmptyState text="Ninguna prenda parecida cumple esos filtros." clearHref={`/feed?similar=${sp.similar}`} />
        ) : (
          <div className="columns-2 gap-3 md:columns-3 md:gap-4 lg:columns-4">
            {rows.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                tagNames={tagNames}
                saved={saved.garments.has(item.id)}
                liked={liked.garments.has(item.id)}
                isLoggedIn={isLoggedIn}
                path="/feed"
                from="similar"
              />
            ))}
          </div>
        )}
      </Shell>
    );
  }

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
      <LinkTabs
        label="Tipo de resultado"
        active={type}
        className="mb-5"
        tabs={TAB_LABELS.map(([t, label]) => ({
          id: t,
          label,
          href: tabHref(t),
          badge: counts[t as keyof typeof counts],
        }))}
      />
    );

    let groups: FilterGroup[] = [];
    let body: React.ReactNode;
    let extraSorts: { value: string; label: string }[] | undefined;
    let resultCount = 0;
    const clearFiltersHref = (() => {
      const params = new URLSearchParams();
      params.set("q", q);
      if (sort !== "relevant") params.set("sort", sort);
      if (type !== "all") params.set("type", type);
      return `/feed?${params}`;
    })();

    const gridKey = JSON.stringify({ q, type, f, sort });

    if (type === "brands") {
      // Spec 011: "Mejor valoradas" y "4 ★ o más" solo en esta pestaña.
      const ratingGroup: FilterGroup = { param: "min_rating", label: "Valoración", options: [{ value: "4", label: "4 ★ o más" }] };
      groups = [styleGroup, ratingGroup];
      extraSorts = [{ value: "rating", label: "Mejor valoradas" }];
      const minRating = sp.min_rating === "4" || (Array.isArray(sp.min_rating) && sp.min_rating.includes("4"));
      const { data, error } = await supabase.rpc("search_brands", {
        q,
        p_user_city: userCity,
        p_styles: f.style.length ? f.style : null,
      });
      const ids = (data ?? []).map((b) => b.id);
      const { data: ratingRows } = ids.length
        ? await supabase.from("brands").select("id, rating_avg, rating_count").in("id", ids)
        : { data: [] as { id: string; rating_avg: number | null; rating_count: number }[] };
      const ratingOf = new Map((ratingRows ?? []).map((r) => [r.id, r]));
      const shown = (id: string) => {
        const r = ratingOf.get(id);
        return r && r.rating_avg != null && r.rating_count >= RATING_MIN_FOR_AVG ? Number(r.rating_avg) : null;
      };
      const rows = [...(data ?? [])].filter((b) => !minRating || (shown(b.id) ?? 0) >= 4).sort((a, b) => {
        if (sort === "rating") return (shown(b.id) ?? -1) - (shown(a.id) ?? -1) || (ratingOf.get(b.id)?.rating_count ?? 0) - (ratingOf.get(a.id)?.rating_count ?? 0);
        if (sort === "az") return a.name.localeCompare(b.name);
        if (sort === "new") return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        if (sort === "popular") return b.garments - a.garments;
        const ca = a.same_city ? 1 : 0;
        const cb = b.same_city ? 1 : 0;
        if (cb !== ca) return cb - ca;
        return b.sim - a.sim;
      });
      if (error) console.error("[feed] search_brands falló:", error.message);
      resultCount = rows.length;
      const brandStyles = await getBrandStyleNames(
        supabase,
        rows.map((b) => b.id),
      );
      body = error ? (
        <p className="text-sm text-text-muted">
          No pudimos cargar marcas en este momento. Intenta de nuevo.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          text={`No encontramos marcas para «${q}».`}
          clearHref={f.style.length || minRating ? clearFiltersHref : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
            <BrandCard
              key={b.id}
              id={b.id}
              logo={b.logo_url}
              slug={b.slug}
              name={b.name}
              bio={b.bio}
              cityName={b.city_name}
              isVerified={b.is_verified}
              isSustainable={b.is_sustainable}
              garments={b.garments}
              styles={brandStyles.get(b.id)}
              rating={shown(b.id) != null ? { avg: shown(b.id)!, count: ratingOf.get(b.id)!.rating_count } : null}
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
      resultCount = rows.length;
      body =
        rows.length === 0 ? (
          <EmptyState text={`No encontramos outfits para «${q}». Prueba con otro término o quita filtros.`} clearHref={clearFiltersHref} />
        ) : (
          <SearchResults rows={rows} gridKey={gridKey} saved={saved} liked={liked} isLoggedIn={isLoggedIn} tagNames={tagNames} />
        );
    } else if (type === "garments") {
      groups = [cityGroup, priceGroup, categoryGroup, styleGroup, colorGroup];
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
      resultCount = rows.length;
      body =
        rows.length === 0 ? (
          <EmptyState text={`No encontramos prendas para «${q}». Prueba con otro término o quita filtros.`} clearHref={clearFiltersHref} />
        ) : (
          <SearchResults rows={rows} gridKey={gridKey} saved={saved} liked={liked} isLoggedIn={isLoggedIn} tagNames={tagNames} />
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
      resultCount = rows.length;
      body =
        rows.length === 0 ? (
          <EmptyState text={`No encontramos nada para «${q}». Prueba con otro término o quita filtros.`} clearHref={clearFiltersHref} />
        ) : (
          <SearchResults rows={rows} gridKey={gridKey} saved={saved} liked={liked} isLoggedIn={isLoggedIn} tagNames={tagNames} />
        );
    }

    return (
      <Shell isLoggedIn={isLoggedIn} groups={groups} sort={sort} suggestions={null} extraSorts={extraSorts}>
        <SearchTracker
          q={q}
          tab={type === "all" ? "feed" : (type as "garments" | "posts" | "brands")}
          sort={sort}
          results={resultCount}
          filters={Object.fromEntries(Object.entries(f).filter(([, v]) => v.length > 0))}
        />
        {tabs}
        {body}
      </Shell>
    );
  }

  // ===================== Modo browse: feed mixto (outfits + prendas) =====================
  // La barra y los filtros se envían primero; los resultados llegan en su propio Suspense, con
  // `key` por filtros + orden para que el esqueleto aparezca también al cambiar un filtro (spec 006).
  const chips = await getSuggestionChips();
  const resultsKey = JSON.stringify({ f, sort });
  const hasFilters = Object.values(f).some((v) => v.length > 0);

  return (
    <Shell isLoggedIn={isLoggedIn} groups={allGroups} sort={sort} suggestions={chips} view={hasFilters ? undefined : "para-ti"}>
      <Suspense key={resultsKey} fallback={<FeedSkeletonGrid />}>
        <BrowseResults
          gridKey={resultsKey}
          filters={f}
          sort={sort}
          saved={saved}
          liked={liked}
          isLoggedIn={isLoggedIn}
          tagNames={tagNames}
        />
      </Suspense>
    </Shell>
  );
}

async function FollowingResults({
  saved,
  liked,
  tagNames,
}: {
  saved: Awaited<ReturnType<typeof getMySavedIds>>;
  liked: { posts: Set<string>; garments: Set<string> };
  tagNames: Record<string, string>;
}) {
  const { items, nextOffset } = await getFollowingFeedPage(0);
  const suggestions = items.length ? [] : await getFollowSuggestions();
  return (
    <FeedGrid
      key="siguiendo"
      track={{ surface: "following", sort: "new" }}
      initialItems={items}
      initialNextOffset={nextOffset}
      initialSaved={saved}
      initialLiked={liked}
      isLoggedIn
      tagNames={tagNames}
      apiQuery={{ ver: "siguiendo" }}
      emptyState={<FollowSuggestions rows={suggestions} />}
    />
  );
}

async function BrowseResults({
  gridKey,
  filters,
  sort,
  saved,
  liked,
  isLoggedIn,
  tagNames,
}: {
  gridKey: string;
  filters: ReturnType<typeof parseFeedParams>["filters"];
  sort: string;
  saved: Awaited<ReturnType<typeof getMySavedIds>>;
  liked: { posts: Set<string>; garments: Set<string> };
  isLoggedIn: boolean;
  tagNames: Record<string, string>;
}) {
  const { items, nextOffset, error } = await getFeedPage(filters, sort);
  if (error)
    return (
      <SystemEmptyState
        icon={CloudOffIcon}
        title="No pudimos cargar el feed"
        description="Intenta de nuevo en un momento."
        action={{ label: "Reintentar", href: "/feed" }}
      />
    );
  return (
    <FeedGrid
      key={gridKey}
      track={{ surface: "feed", sort }}
      initialItems={items}
      initialNextOffset={nextOffset}
      initialSaved={saved}
      initialLiked={liked}
      isLoggedIn={isLoggedIn}
      tagNames={tagNames}
    />
  );
}

// Resultados de búsqueda ya ordenados: la página manda las primeras 24 tarjetas y FeedGrid pide el
// resto por tandas al bajar (spec 006, FR-019).
function SearchResults({
  rows,
  gridKey,
  saved,
  liked,
  isLoggedIn,
  tagNames,
}: {
  rows: FeedItem[];
  gridKey: string;
  saved: Awaited<ReturnType<typeof getMySavedIds>>;
  liked: { posts: Set<string>; garments: Set<string> };
  isLoggedIn: boolean;
  tagNames: Record<string, string>;
}) {
  return (
    <FeedGrid
      key={gridKey}
      track={{ surface: "search" }}
      initialItems={rows.slice(0, FEED_PAGE_SIZE)}
      pendingIds={rows.slice(FEED_PAGE_SIZE).map((r) => r.id)}
      initialSaved={saved}
      initialLiked={liked}
      isLoggedIn={isLoggedIn}
      tagNames={tagNames}
    />
  );
}

// Sin resultados en búsqueda o filtros (spec 007): estado vacío del sistema con una salida.
function EmptyState({ text, clearHref = "/feed" }: { text: string; clearHref?: string }) {
  return (
    <SystemEmptyState
      icon={SearchXIcon}
      title="No encontramos nada"
      description={text}
      action={{ label: clearHref === "/feed" ? "Ver todo el feed" : "Quitar filtros", href: clearHref }}
    />
  );
}

function Shell({
  groups,
  sort,
  suggestions,
  isLoggedIn,
  view,
  extraSorts,
  children,
}: {
  extraSorts?: { value: string; label: string }[];
  groups: FilterGroup[];
  sort: string;
  isLoggedIn: boolean;
  suggestions: Awaited<ReturnType<typeof getSuggestionChips>> | null;
  /** Con sesión, en el feed sin búsqueda: selector "Para ti" / "Siguiendo" (spec 009). */
  view?: "para-ti" | "siguiendo";
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-3 py-5 md:px-6">
        <Suspense>
          <FlashToast messages={FEED_FLASH} />
        </Suspense>
        <h1 className="mt-2 mb-4 text-h1 text-text">Explorar</h1>
        {isLoggedIn && view && (
          <LinkTabs
            label="Vista del feed"
            active={view}
            className="mb-4"
            tabs={[
              { id: "para-ti", label: "Para ti", href: "/feed" },
              { id: "siguiendo", label: "Siguiendo", href: "/feed?ver=siguiendo" },
            ]}
          />
        )}
        {view !== "siguiendo" && (
          <>
            <div className="mb-4">
              <FeedTopBar groups={groups} sort={sort} isLoggedIn={isLoggedIn} extraSorts={extraSorts} />
            </div>
            {suggestions && suggestions.length > 0 && <FeedSuggestions chips={suggestions} />}
            <FeedActiveChips groups={groups} />
          </>
        )}
        {children}
      </div>
    </>
  );
}
