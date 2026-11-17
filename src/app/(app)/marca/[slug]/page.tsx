import { DetailView } from "@/components/events/detail-view";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cityLabel } from "@/lib/cities";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRightIcon, BadgeCheckIcon, ImageIcon, ShirtIcon } from "lucide-react";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/post-card";
import { BrandGarments } from "@/components/brand-garments";
import { FollowButton } from "@/components/follow-button";
import { getMySavedIds } from "@/lib/saves";
import { getGarmentLikeCounts, getMyFollowedBrandIds, getMyLikedGarmentIds, getMyLikedPostIds } from "@/lib/social";
import { getCurrentUser } from "@/lib/auth";
import { instagramUrl, normalizeInstagramHandle, normalizeUrl } from "@/lib/links";
import { StarIcon } from "lucide-react";
import { RatingSummary } from "@/components/ratings/rating-summary";
import { RatingList } from "@/components/ratings/rating-list";
import { RatingFormSheet } from "@/components/ratings/rating-form-sheet";
import { formatRating, getMyRating, getRatings, showsAverage, summaryFrom, type RatingSort } from "@/lib/ratings";

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; orden?: string; estrellas?: string }>;
}) {
  // Next entrega el segmento codificado ("fx-j%C3%B6er"): se decodifica para buscar el slug real.
  const { slug: rawSlug } = await params;
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug).normalize("NFC");
  } catch {}
  const { tab: tabParam, orden, estrellas } = await searchParams;
  const tab = tabParam === "looks" ? "looks" : tabParam === "resenas" ? "resenas" : "prendas";
  const supabase = await createClient();

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, slug, city_id, store_url, instagram, bio, is_verified, is_sustainable, logo_url, owner_user_id, rating_avg, rating_count, rating_dist")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!brand) notFound();
  // Normalizados al render: valores viejos pueden venir con "https://" duplicado o como URL de Instagram.
  const storeUrl = normalizeUrl(brand.store_url);
  const instagramHandle = normalizeInstagramHandle(brand.instagram);
  const instagramHref = instagramUrl(brand.instagram);

  // Consultas independientes en paralelo (spec 006, US4).
  const [city, { data: brandTags }, { data: posts }, { data: garments }, saved, followedBrandIds, likedPostIds, likedGarmentIds, session] =
    await Promise.all([
      brand.city_id
        ? supabase.from("cities").select("name, department").eq("id", brand.city_id).maybeSingle().then((r) => r.data)
        : Promise.resolve(null),
      supabase.from("brand_tags").select("tag_id").eq("brand_id", brand.id),
      supabase
        .from("post_feed")
        .select("*")
        .eq("brand_slug", slug)
        .order("published_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("garments")
        .select("id, title, price_cop")
        .eq("brand_id", brand.id)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      getMySavedIds(),
      getMyFollowedBrandIds(),
      getMyLikedPostIds(),
      getMyLikedGarmentIds(),
      getCurrentUser(),
    ]);
  const cityName = city ? cityLabel(city.name, city.department) : null;

  const styleIds = (brandTags ?? []).map((t) => t.tag_id);
  const gids = (garments ?? []).map((g) => g.id);
  const [styles, gimages, garmentLikeCounts] = await Promise.all([
    styleIds.length
      ? supabase.from("tags").select("name, slug").in("id", styleIds).order("name").then((r) => r.data ?? [])
      : Promise.resolve([]),
    gids.length
      ? supabase
          .from("garment_images")
          .select("garment_id, cf_image_id, position")
          .in("garment_id", gids)
          .order("position")
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    getGarmentLikeCounts(gids),
  ]);
  const imageOf = (gid: string) =>
    gimages.find((x) => x.garment_id === gid)?.cf_image_id ?? null;

  const path = `/marca/${slug}`;
  const isFollowing = followedBrandIds.has(brand.id);
  const isLoggedIn = Boolean(session?.profile);

  // Reseñas (spec 011).
  const ratingSummary = summaryFrom(brand);
  const myId = session?.profile?.id ?? null;
  const isOwner = !!myId && brand.owner_user_id === myId;
  const canRate = isLoggedIn && !isOwner && session?.profile?.role !== "brand";
  const ratingSort: RatingSort = orden === "altas" ? "high" : orden === "bajas" ? "low" : "recent";
  const starsFilter = estrellas && /^[1-5]$/.test(estrellas) ? Number(estrellas) : null;
  const [myRating, ratingPage] =
    tab === "resenas"
      ? await Promise.all([getMyRating(brand.id, myId), getRatings(brand.id, { sort: ratingSort, stars: starsFilter ?? undefined, offset: 0 })])
      : [null, null];
  const ratingsHref = (o: string | null, e: number | null) =>
    `/marca/${slug}?tab=resenas${o ? `&orden=${o}` : ""}${e ? `&estrellas=${e}` : ""}`;
  const ordenParam = ratingSort === "high" ? "altas" : ratingSort === "low" ? "bajas" : null;

  const garmentCount = garments?.length ?? 0;
  const lookCount = posts?.length ?? 0;

  // Página de marca con estructura de perfil (spec 007, US4): logo, nombre, ciudad, estilos, seguir y
  // enlaces; luego pestañas Prendas / Looks. La spec 009 reutiliza esta misma estructura para usuarios.
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
      <DetailView itemKind="brand" itemId={brand.id} />
      <header className="surface overflow-hidden">
        <div className="h-20 bg-surface-inverse md:h-28" aria-hidden />
        <div className="px-5 pb-5 md:px-8 md:pb-7">
          {/* Logo de la tienda (ajuste de la dueña, 2026-11-16). */}
          <Avatar
            image={brand.logo_url}
            name={brand.name}
            seed={brand.id}
            size={96}
            priority
            className="-mt-12 border-4 border-surface-raised bg-surface-raised"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-h1 text-text">{brand.name}</h1>
            {brand.is_verified && (
              <Badge variant="verified">
                <BadgeCheckIcon data-icon="inline-start" /> Verificada
              </Badge>
            )}
            {brand.is_sustainable && <Badge variant="neutral">Sostenible</Badge>}
          </div>
          {cityName && <p className="mt-1 text-sm text-text-muted">{cityName}</p>}
          {showsAverage(ratingSummary) && (
            <Link href={`/marca/${slug}?tab=resenas`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-text hover:underline">
              <StarIcon className="size-4 fill-honey text-ink" aria-hidden />
              <strong className="font-semibold">{formatRating(ratingSummary.avg)}</strong>
              <span className="text-text-muted">· {ratingSummary.count} reseñas</span>
            </Link>
          )}
          {brand.bio && <p className="mt-3 max-w-2xl text-[15px] leading-6 text-text">{brand.bio}</p>}
          {styles.length > 0 && (
            <ul aria-label="Estilos" className="mt-3 flex flex-wrap gap-x-2">
              {styles.map((s) => (
                <li key={s.slug}>
                  <Chip variant="tag">{s.name}</Chip>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FollowButton brandId={brand.id} slug={slug} initialFollowing={isFollowing} isLoggedIn={isLoggedIn} />
            {storeUrl && (
              <Button render={<a href={storeUrl} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                Visitar tienda <ArrowUpRightIcon data-icon="inline-end" />
              </Button>
            )}
            {instagramHref && instagramHandle && (
              <Button variant="secondary" render={<a href={instagramHref} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                @{instagramHandle}
              </Button>
            )}
          </div>
        </div>
      </header>

      <LinkTabs
        label="Contenido de la marca"
        variant="underline"
        active={tab}
        className="mt-6 mb-5"
        tabs={[
          { id: "prendas", label: "Prendas", href: `/marca/${slug}`, badge: garmentCount },
          { id: "looks", label: "Looks", href: `/marca/${slug}?tab=looks`, badge: lookCount },
          { id: "resenas", label: "Reseñas", href: `/marca/${slug}?tab=resenas`, badge: ratingSummary.count },
        ]}
      />

      {tab === "resenas" ? (
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <RatingSummary summary={ratingSummary} />
          {myRating?.status === "removed" && (
            <p role="status" className="rounded-[var(--radius-card)] bg-surface-sunken p-4 text-sm text-text">
              El equipo de Icon retiró tu reseña de esta marca. Solo tú ves este aviso.
            </p>
          )}
          {myRating?.status === "auto_hidden" && (
            <p role="status" className="rounded-[var(--radius-card)] bg-surface-sunken p-4 text-sm text-text">
              Tu reseña está oculta mientras el equipo revisa unos reportes.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <LinkTabs
              label="Orden de las reseñas"
              size="sm"
              active={ratingSort}
              tabs={[
                { id: "recent", label: "Recientes", href: ratingsHref(null, starsFilter) },
                { id: "high", label: "Más altas", href: ratingsHref("altas", starsFilter) },
                { id: "low", label: "Más bajas", href: ratingsHref("bajas", starsFilter) },
              ]}
            />
            {canRate && myRating?.status !== "removed" && (
              <RatingFormSheet brandId={brand.id} brandName={brand.name} initial={myRating ? { stars: myRating.stars, body: myRating.body } : undefined} />
            )}
            {!isLoggedIn && (
              <Button variant="secondary" render={<Link href={`/login?next=${encodeURIComponent(`/marca/${slug}?tab=resenas`)}`} />} nativeButton={false}>
                <StarIcon data-icon="inline-start" /> Escribir reseña
              </Button>
            )}
          </div>
          <nav aria-label="Filtrar por estrellas" className="flex flex-wrap gap-2">
            {[5, 4, 3, 2, 1].map((n) => (
              <Link
                key={n}
                href={ratingsHref(ordenParam, starsFilter === n ? null : n)}
                aria-current={starsFilter === n ? "true" : undefined}
                className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold ${starsFilter === n ? "bg-surface-inverse text-text-inverse" : "border-[1.5px] border-line-strong text-text hover:bg-surface-sunken"}`}
              >
                {n} <StarIcon className="size-3.5" aria-hidden />
              </Link>
            ))}
          </nav>
          {ratingPage && ratingPage.items.length > 0 ? (
            <RatingList
              key={`${ratingSort}:${starsFilter}`}
              brandId={brand.id}
              sort={ratingSort}
              stars={starsFilter}
              initial={ratingPage.items}
              initialNext={ratingPage.nextOffset}
              myId={myId}
              isLoggedIn={isLoggedIn}
            />
          ) : (
            <EmptyState
              icon={StarIcon}
              title={starsFilter ? "No hay reseñas con esas estrellas" : "Aún no hay reseñas"}
              description={starsFilter ? "Prueba con otro filtro." : `Cuéntale a la comunidad cómo te fue con ${brand.name}.`}
            />
          )}
        </div>
      ) : tab === "looks" ? (
        lookCount > 0 ? (
          <div className="columns-2 gap-3 md:columns-3 md:gap-4 lg:columns-4">
            {posts!.map((p) => (
              <PostCard key={p.id} post={p} saved={saved.posts.has(p.id)} liked={likedPostIds.has(p.id)} isLoggedIn={isLoggedIn} path={path} />
            ))}
          </div>
        ) : (
          <EmptyState icon={ImageIcon} title="Aún no hay looks" description={`Cuando ${brand.name} publique looks, aparecerán aquí.`} />
        )
      ) : garmentCount > 0 ? (
        <BrandGarments
          garments={garments!.map((g) => ({
            id: g.id,
            title: g.title,
            price_cop: g.price_cop,
            image: imageOf(g.id),
            likeCount: garmentLikeCounts.get(g.id) ?? 0,
          }))}
          savedIds={[...saved.garments]}
          likedIds={[...likedGarmentIds]}
          isLoggedIn={isLoggedIn}
          path={path}
        />
      ) : (
        <EmptyState icon={ShirtIcon} title="Aún no hay prendas" description={`${brand.name} todavía no tiene prendas publicadas.`} />
      )}
    </div>
  );
}
