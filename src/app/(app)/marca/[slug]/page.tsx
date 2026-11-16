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

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "looks" ? "looks" : "prendas";
  const supabase = await createClient();

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, slug, city_id, store_url, instagram, bio, is_verified, is_sustainable, logo_url")
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

  const garmentCount = garments?.length ?? 0;
  const lookCount = posts?.length ?? 0;

  // Página de marca con estructura de perfil (spec 007, US4): logo, nombre, ciudad, estilos, seguir y
  // enlaces; luego pestañas Prendas / Looks. La spec 009 reutiliza esta misma estructura para usuarios.
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
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
        ]}
      />

      {tab === "looks" ? (
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
