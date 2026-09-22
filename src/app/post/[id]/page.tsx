import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { formatCop, priceLabel } from "@/lib/taxonomy";
import { imageUrl } from "@/lib/images";
import { getMySavedIds } from "@/lib/saves";
import { SaveButton } from "@/components/save-button";
import { LikeButton } from "@/components/like-button";
import { getMyLikedPostIds } from "@/lib/social";
import { getCurrentUser } from "@/lib/auth";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: header } = await supabase
    .from("post_feed")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!header) notFound();

  const { data: images } = await supabase
    .from("post_images")
    .select("cf_image_id, position")
    .eq("post_id", id)
    .order("position");

  const { data: items } = await supabase
    .from("post_items")
    .select("garment_id, size_id")
    .eq("post_id", id);

  const garmentIds = (items ?? []).map((i) => i.garment_id);
  const sizeIds = (items ?? [])
    .map((i) => i.size_id)
    .filter((x): x is string => Boolean(x));

  const garments = garmentIds.length
    ? ((
        await supabase
          .from("garments")
          .select("id, title, price_cop, product_url, color, fabric, brand_id")
          .in("id", garmentIds)
      ).data ?? [])
    : [];
  const gimages = garmentIds.length
    ? ((
        await supabase
          .from("garment_images")
          .select("garment_id, cf_image_id, position")
          .in("garment_id", garmentIds)
          .order("position")
      ).data ?? [])
    : [];
  const sizes = sizeIds.length
    ? ((await supabase.from("sizes").select("id, label").in("id", sizeIds)).data ??
      [])
    : [];
  const brandIds = [...new Set(garments.map((g) => g.brand_id))];
  const itemBrands = brandIds.length
    ? ((await supabase.from("brands").select("id, name, slug").in("id", brandIds))
        .data ?? [])
    : [];

  const firstImageOf = (gid: string) =>
    gimages.find((gi) => gi.garment_id === gid)?.cf_image_id ?? null;
  const sizeLabel = (sid: string | null) =>
    sid ? (sizes.find((s) => s.id === sid)?.label ?? null) : null;
  const brandOf = (bid: string) => itemBrands.find((b) => b.id === bid);

  const gallery = images?.length
    ? images.map((i) => i.cf_image_id)
    : header.image
      ? [header.image]
      : [];
  const chips = [...header.occasions, ...header.styles, ...header.temperatures];
  const [saved, likedPostIds, session] = await Promise.all([
    getMySavedIds(),
    getMyLikedPostIds(),
    getCurrentUser(),
  ]);
  const path = `/post/${id}`;
  const isLoggedIn = Boolean(session?.profile);

  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <SiteHeader />

        <Link
          href="/feed"
          className="mt-6 inline-block text-sm font-medium text-coral hover:underline"
        >
          ← Volver al feed
        </Link>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {/* Galería */}
          <div className="flex flex-col gap-4">
            {gallery.map((src, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={idx}
                src={imageUrl(src) ?? ""}
                alt={header.caption ?? header.brand_name}
                className="w-full rounded-2xl"
              />
            ))}
          </div>

          {/* Info + prendas */}
          <div className="flex flex-col gap-4">
            <GlassCard className="relative p-5">
              <div className="absolute right-4 top-4 flex items-center gap-2">
                <LikeButton
                  postId={id}
                  initialLiked={likedPostIds.has(id)}
                  initialCount={header.like_count}
                  path={path}
                  isLoggedIn={isLoggedIn}
                />
                <SaveButton
                  kind="post"
                  id={id}
                  saved={saved.posts.has(id)}
                  path={path}
                />
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-forest">
                {header.brand_name}
                {header.brand_verified && (
                  <span aria-label="verificada" title="Verificada por el equipo">
                    ✓
                  </span>
                )}
              </div>
              {header.city_name && (
                <p className="text-xs text-ink/50">{header.city_name}</p>
              )}
              {header.caption && (
                <p className="mt-3 text-lg text-ink/80">{header.caption}</p>
              )}
              {priceLabel(header.min_price, header.max_price) && (
                <p className="mt-2 text-sm text-ink/60">
                  {priceLabel(header.min_price, header.max_price)}
                </p>
              )}
              {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-white/50 px-2.5 py-0.5 text-xs text-forest-deep"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </GlassCard>

            <h2 className="mt-2 text-sm font-medium uppercase tracking-wide text-ink/50">
              Prendas en este look
            </h2>
            <div className="flex flex-col gap-3">
              {(items ?? []).map((it) => {
                const g = garments.find((x) => x.id === it.garment_id);
                if (!g) return null;
                const img = imageUrl(firstImageOf(g.id));
                const size = sizeLabel(it.size_id);
                const brand = brandOf(g.brand_id);
                return (
                  <GlassCard key={g.id} className="flex gap-3 p-3">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={g.title}
                        className="h-24 w-20 flex-none rounded-xl object-cover"
                      />
                    )}
                    <div className="flex flex-1 flex-col">
                      <Link
                        href={`/prenda/${g.id}`}
                        className="text-sm font-medium text-forest hover:underline"
                      >
                        {g.title}
                      </Link>
                      {brand && (
                        <span className="text-xs text-ink/50">{brand.name}</span>
                      )}
                      <span className="mt-0.5 text-xs text-ink/60">
                        {[g.color, size ? `Talla ${size}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        {g.price_cop != null ? (
                          <span className="text-sm text-ink/80">
                            {formatCop(g.price_cop)}
                          </span>
                        ) : (
                          <span />
                        )}
                        <div className="flex items-center gap-2">
                          <SaveButton
                            kind="garment"
                            id={g.id}
                            sourcePostId={id}
                            saved={saved.garments.has(g.id)}
                            path={path}
                          />
                          <a
                            href={`/out/${g.id}?post=${id}&source=post`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-deep"
                          >
                            Ver en la tienda ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
