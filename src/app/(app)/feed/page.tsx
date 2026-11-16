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
import { FEED_PAGE_SIZE, parseFeedParams, getFeedPage, type FeedItem } from "@/lib/feed";
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
    const clearFiltersHref = (() => {
      const params = new URLSearchParams();
      params.set("q", q);
      if (sort !== "relevant") params.set("sort", sort);
      if (type !== "all") params.set("type", type);
      return `/feed?${params}`;
    })();

    const gridKey = JSON.stringify({ q, type, f, sort });

    if (type === "brands") {
      groups = [styleGroup];
      const { data, error } = await supabase.rpc("search_brands", {
        q,
        p_user_city: userCity,
        p_styles: f.style.length ? f.style : null,
      });
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
          clearHref={f.style.length ? clearFiltersHref : undefined}
        />
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
              styles={brandStyles.get(b.id)}
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
      body =
        rows.length === 0 ? (
          <EmptyState text={`No encontramos nada para «${q}». Prueba con otro término o quita filtros.`} clearHref={clearFiltersHref} />
        ) : (
          <SearchResults rows={rows} gridKey={gridKey} saved={saved} liked={liked} isLoggedIn={isLoggedIn} tagNames={tagNames} />
        );
    }

    return (
      <Shell isLoggedIn={isLoggedIn} groups={groups} sort={sort} suggestions={null}>
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

  return (
    <Shell isLoggedIn={isLoggedIn} groups={allGroups} sort={sort} suggestions={chips}>
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
  children,
}: {
  groups: FilterGroup[];
  sort: string;
  isLoggedIn: boolean;
  suggestions: Awaited<ReturnType<typeof getSuggestionChips>> | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-3 py-5 md:px-6">
        <Suspense>
          <FlashToast messages={FEED_FLASH} />
        </Suspense>
        <h1 className="mt-2 mb-4 text-h1 text-text">Explorar</h1>
        <div className="mb-4">
          <FeedTopBar groups={groups} sort={sort} isLoggedIn={isLoggedIn} />
        </div>
        {suggestions && suggestions.length > 0 && <FeedSuggestions chips={suggestions} />}
        <FeedActiveChips groups={groups} />
        {children}
      </div>
    </>
  );
}
