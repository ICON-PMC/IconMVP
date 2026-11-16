import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { R2Image } from "@/components/r2-image";
import { ArrowLeftIcon, ArrowUpRightIcon, BadgeCheckIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { Price } from "@/components/price";
import { Button } from "@/components/ui/button";
import { priceLabel } from "@/lib/taxonomy";
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

  // Consultas independientes en paralelo (spec 006, US4).
  const [{ data: images }, { data: items }] = await Promise.all([
    supabase.from("post_images").select("cf_image_id, position").eq("post_id", id).order("position"),
    supabase.from("post_items").select("garment_id, size_id").eq("post_id", id),
  ]);

  const garmentIds = (items ?? []).map((i) => i.garment_id);
  const sizeIds = (items ?? [])
    .map((i) => i.size_id)
    .filter((x): x is string => Boolean(x));

  const [garments, gimages, sizes] = await Promise.all([
    garmentIds.length
      ? supabase
          .from("garments")
          .select("id, title, price_cop, product_url, color, fabric, brand_id")
          .in("id", garmentIds)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    garmentIds.length
      ? supabase
          .from("garment_images")
          .select("garment_id, cf_image_id, position")
          .in("garment_id", garmentIds)
          .order("position")
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    sizeIds.length
      ? supabase.from("sizes").select("id, label").in("id", sizeIds).then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);
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

  const author = header.brand_name ?? "Icon";
  const price = priceLabel(header.min_price, header.max_price);

  // Ficha de look (spec 007, US4): fotos con su proporción, quien lo publica, texto, etiquetas y las
  // prendas del look como tarjetas compactas con su botón a la tienda.
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
      <Link
        href="/feed"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-action-text hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Volver al feed
      </Link>

      <div className="grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10">
        <div className="flex flex-col gap-3">
          {gallery.map((src, idx) => (
            <R2Image
              key={idx}
              image={src}
              alt={header.caption ?? `Look de ${author}`}
              sizes="(min-width: 1152px) 640px, (min-width: 768px) 58vw, 100vw"
              priority={idx === 0}
              className="aspect-[4/5] w-full rounded-[var(--radius-card)] bg-surface-sunken object-cover"
            />
          ))}
        </div>

        <div className="flex flex-col gap-5 md:sticky md:top-24 md:self-start">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar image={null} name={author} seed={header.brand_id ?? id} size={48} />
              <div className="min-w-0">
                <p className="flex items-center gap-1 font-semibold text-text">
                  {header.brand_slug ? (
                    <Link href={`/marca/${header.brand_slug}`} className="hover:underline">
                      {author}
                    </Link>
                  ) : (
                    author
                  )}
                  {header.brand_verified && <BadgeCheckIcon className="size-4 text-forest" aria-label="verificada" />}
                </p>
                {header.city_name && <p className="text-[13px] text-text-muted">{header.city_name}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SaveButton kind="post" id={id} saved={saved.posts.has(id)} path={path} />
              <LikeButton itemId={id} initialLiked={likedPostIds.has(id)} initialCount={header.like_count} path={path} isLoggedIn={isLoggedIn} />
            </div>
          </div>

          {header.caption && <p className="text-[17px] leading-7 text-text">{header.caption}</p>}
          {price && <p className="text-sm font-semibold text-text-muted">{price}</p>}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-x-2">
              {chips.map((c) => (
                <Chip key={c} variant="tag">
                  {c}
                </Chip>
              ))}
            </div>
          )}

          <section aria-labelledby="look-items">
            <h2 id="look-items" className="mb-3 text-h3 text-text">
              Prendas en este look
            </h2>
            <ul className="flex flex-col gap-3">
              {(items ?? []).map((it) => {
                const g = garments.find((x) => x.id === it.garment_id);
                if (!g) return null;
                const size = sizeLabel(it.size_id);
                const brand = brandOf(g.brand_id);
                return (
                  <li key={g.id} className="surface flex gap-3 p-2.5">
                    <Link href={`/prenda/${g.id}`} className="shrink-0">
                      <R2Image image={firstImageOf(g.id)} alt={g.title} sizes="80px" className="h-24 w-20 rounded-[var(--radius-field)] bg-surface-sunken object-cover" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Link href={`/prenda/${g.id}`} className="truncate text-sm font-semibold text-text hover:underline">
                        {g.title}
                      </Link>
                      {brand && <span className="truncate text-[13px] text-text-muted">{brand.name}</span>}
                      <span className="text-xs text-text-muted">
                        {[g.color, size ? `Talla ${size}` : null].filter(Boolean).join(" · ")}
                      </span>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                        <Price min={g.price_cop} className="text-sm" />
                        <div className="flex items-center gap-1.5">
                          <SaveButton kind="garment" id={g.id} sourcePostId={id} saved={saved.garments.has(g.id)} path={path} compact />
                          <Button
                            size="sm"
                            render={<a href={`/out/${g.id}?post=${id}&source=post`} target="_blank" rel="noopener noreferrer" />}
                            nativeButton={false}
                          >
                            Tienda <ArrowUpRightIcon data-icon="inline-end" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
