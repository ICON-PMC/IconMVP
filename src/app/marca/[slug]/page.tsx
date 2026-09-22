import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { PostCard } from "@/components/post-card";
import { GarmentCard } from "@/components/garment-card";
import { FollowButton } from "@/components/follow-button";
import { getMySavedIds } from "@/lib/saves";
import { getMyFollowedBrandIds, getMyLikedPostIds } from "@/lib/social";
import { getCurrentUser } from "@/lib/auth";

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, slug, city_id, store_url, instagram, bio, is_verified, is_sustainable")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!brand) notFound();

  let cityName: string | null = null;
  if (brand.city_id) {
    cityName =
      (await supabase.from("cities").select("name").eq("id", brand.city_id).maybeSingle())
        .data?.name ?? null;
  }

  const { data: posts } = await supabase
    .from("post_feed")
    .select("*")
    .eq("brand_slug", slug)
    .order("published_at", { ascending: false, nullsFirst: false });

  const { data: garments } = await supabase
    .from("garments")
    .select("id, title, price_cop")
    .eq("brand_id", brand.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const gids = (garments ?? []).map((g) => g.id);
  const gimages = gids.length
    ? ((
        await supabase
          .from("garment_images")
          .select("garment_id, cf_image_id, position")
          .in("garment_id", gids)
          .order("position")
      ).data ?? [])
    : [];
  const imageOf = (gid: string) =>
    gimages.find((x) => x.garment_id === gid)?.cf_image_id ?? null;

  const [saved, followedBrandIds, likedPostIds, session] = await Promise.all([
    getMySavedIds(),
    getMyFollowedBrandIds(),
    getMyLikedPostIds(),
    getCurrentUser(),
  ]);
  const path = `/marca/${slug}`;
  const isFollowing = followedBrandIds.has(brand.id);
  const isLoggedIn = Boolean(session?.profile);

  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <SiteHeader />

        {/* Cabecera de marca */}
        <GlassCard className="mt-6 p-6">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-medium tracking-tight text-forest">
              {brand.name}
            </h1>
            {brand.is_verified && (
              <span aria-label="verificada" title="Verificada por el equipo">
                ✓
              </span>
            )}
            {brand.is_sustainable && (
              <span className="rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-medium text-forest-deep">
                sostenible
              </span>
            )}
          </div>
          {cityName && <p className="mt-1 text-sm text-ink/50">{cityName}</p>}
          {brand.bio && <p className="mt-3 max-w-xl text-ink/70">{brand.bio}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <FollowButton
              brandId={brand.id}
              slug={slug}
              initialFollowing={isFollowing}
              isLoggedIn={isLoggedIn}
            />
            {brand.store_url && (
              <a
                href={brand.store_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-forest px-4 py-2 font-medium text-white hover:bg-forest-deep"
              >
                Visitar tienda ↗
              </a>
            )}
            {brand.instagram && (
              <a
                href={`https://instagram.com/${brand.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-input rounded-full px-4 py-2 font-medium text-ink/80 hover:bg-white/70"
              >
                @{brand.instagram}
              </a>
            )}
          </div>
        </GlassCard>

        {/* Posts */}
        <h2 className="mt-10 mb-4 text-sm font-medium uppercase tracking-wide text-ink/50">
          Posts
        </h2>
        {posts && posts.length > 0 ? (
          <div className="columns-2 gap-4 md:columns-3">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                saved={saved.posts.has(p.id)}
                liked={likedPostIds.has(p.id)}
                isLoggedIn={isLoggedIn}
                path={path}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/50">Aún no hay posts.</p>
        )}

        {/* Items de la tienda */}
        <h2 className="mt-10 mb-4 text-sm font-medium uppercase tracking-wide text-ink/50">
          Items de la tienda
        </h2>
        {garments && garments.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {garments.map((g) => (
              <GarmentCard
                key={g.id}
                id={g.id}
                title={g.title}
                price_cop={g.price_cop}
                image={imageOf(g.id)}
                saved={saved.garments.has(g.id)}
                path={path}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/50">Aún no hay items.</p>
        )}

        {/* Reviews (futuro) */}
        <h2 className="mt-10 mb-4 text-sm font-medium uppercase tracking-wide text-ink/50">
          Reviews
        </h2>
        <p className="mb-10 text-sm text-ink/50">Próximamente.</p>
      </div>
    </>
  );
}
