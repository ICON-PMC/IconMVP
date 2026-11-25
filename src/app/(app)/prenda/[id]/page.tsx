import { DetailView } from "@/components/events/detail-view";
import Link from "next/link";
import { cityLabel } from "@/lib/cities";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { R2Image } from "@/components/r2-image";
import { ArrowLeftIcon, ArrowUpRightIcon, BadgeCheckIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { Price } from "@/components/price";
import { StickyActionBar } from "@/components/sticky-action-bar";
import { Button } from "@/components/ui/button";
import { getMySavedIds } from "@/lib/saves";
import { getGarmentLikeCounts, getMyLikedGarmentIds } from "@/lib/social";
import { getCurrentUser } from "@/lib/auth";
import { SaveButton } from "@/components/save-button";
import { LikeButton } from "@/components/like-button";
import { SimilarGarments } from "@/components/visual/similar-garments";

// Orígenes que la ficha conserva para atribuir el clic saliente (spec 005, FR-010).
const FROM_SOURCES = new Set(["photo_search", "similar"]);

export default async function GarmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const outSource = from && FROM_SOURCES.has(from) ? from : "garment";
  const supabase = await createClient();

  const { data: g } = await supabase
    .from("garments")
    .select("id, title, description, price_cop, product_url, color, fabric, brand_id")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!g) notFound();

  // Todo lo que solo depende de la prenda va en paralelo (spec 006, US4); antes eran ~8 consultas
  // una detrás de otra.
  const [
    { data: images },
    { data: brand },
    { data: gs },
    { data: gt },
    saved,
    likedGarmentIds,
    session,
    garmentLikeCounts,
  ] = await Promise.all([
    supabase.from("garment_images").select("cf_image_id, position, width, height").eq("garment_id", id).order("position"),
    supabase
      .from("brands")
      .select("id, name, slug, city_id, is_verified, is_sustainable, is_active, logo_url")
      .eq("id", g.brand_id)
      .maybeSingle(),
    supabase.from("garment_sizes").select("size_id").eq("garment_id", id),
    supabase.from("garment_tags").select("tag_id").eq("garment_id", id),
    getMySavedIds(),
    getMyLikedGarmentIds(),
    getCurrentUser(),
    getGarmentLikeCounts([g.id]),
  ]);
  // La prenda puede seguir "published" mientras su marca queda desactivada (p.ej. una
  // marca con acceso propio que aún no pasa la revisión de staff, is_active=false por
  // defecto) — sin esto, la prenda seguiría visible por URL directa aunque /marca/[slug]
  // ya dé 404 para esa marca.
  if (!brand || !brand.is_active) notFound();

  const sizeIds = (gs ?? []).map((x) => x.size_id);
  const tagIds = (gt ?? []).map((x) => x.tag_id);
  // Categoría primero; luego estilo, ocasión y clima.
  const TAG_ORDER = ["category", "style", "occasion", "temperature"];
  // Segunda tanda: lo que depende de la primera, también en paralelo.
  const [city, sizes, tagRows] = await Promise.all([
    brand.city_id
      ? supabase.from("cities").select("name, department").eq("id", brand.city_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    sizeIds.length
      ? supabase
          .from("sizes")
          .select("label, sort_order")
          .in("id", sizeIds)
          .order("sort_order")
          .then((r) => r.data ?? [])
      : Promise.resolve([] as { label: string; sort_order: number }[]),
    tagIds.length
      ? supabase.from("tags").select("name, type").in("id", tagIds).then((r) => r.data ?? [])
      : Promise.resolve([] as { name: string; type: string }[]),
  ]);
  const cityName = city ? cityLabel(city.name, city.department) : null;
  const categories = [...tagRows].sort(
    (a, b) => TAG_ORDER.indexOf(a.type) - TAG_ORDER.indexOf(b.type) || a.name.localeCompare(b.name),
  );

  const gallery = images ?? [];
  const meta = [g.color, g.fabric].filter(Boolean).join(" · ");
  const isLoggedIn = Boolean(session?.profile);

  const path = `/prenda/${g.id}`;
  const outHref = `/out/${g.id}?source=${outSource}`;
  const actions = (
    <>
      <SaveButton kind="garment" id={g.id} saved={saved.garments.has(g.id)} path={path} />
      <LikeButton
        kind="garment"
        itemId={g.id}
        initialLiked={likedGarmentIds.has(g.id)}
        initialCount={garmentLikeCounts.get(g.id) ?? 0}
        path={path}
        isLoggedIn={isLoggedIn}
      />
    </>
  );

  // Ficha de prenda (spec 007, US4): foto grande con su proporción real, y a la derecha (o debajo en
  // celular) marca, nombre, precio, etiquetas y tallas. "Ir a la tienda" siempre visible en celular.
  return (
    // pb-24 en celular: espacio para la barra fija de "Ir a la tienda" además de la de navegación.
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-24 md:px-6 md:pb-5">
      <PageHeaderBack />
      <DetailView itemKind="garment" itemId={id} />

      <div className="grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10">
        <div className="flex flex-col gap-3">
          {gallery.map((img, idx) => (
            <div
              key={img.cf_image_id}
              className="overflow-hidden rounded-[var(--radius-card)] bg-surface-sunken"
              style={{ aspectRatio: img.width && img.height ? `${img.width} / ${img.height}` : "4 / 5" }}
            >
              <R2Image
                image={img.cf_image_id}
                alt={idx === 0 ? g.title : `${g.title}, foto ${idx + 1}`}
                sizes="(min-width: 1152px) 640px, (min-width: 768px) 58vw, 100vw"
                priority={idx === 0}
                className="size-full object-cover"
              />
            </div>
          ))}
          {gallery.length === 0 && (
            <div className="flex aspect-[4/5] items-end rounded-[var(--radius-card)] bg-leaf-soft p-6 text-h2">{g.title}</div>
          )}
        </div>

        <div className="md:sticky md:top-24 md:self-start">
          {brand && (
            <Link href={`/marca/${brand.slug}`} className="group flex w-fit items-center gap-3">
              <Avatar image={brand.logo_url} name={brand.name} seed={brand.id} size={48} className="border border-line bg-surface-raised" />
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-semibold text-text group-hover:underline">
                  {brand.name}
                  {brand.is_verified && <BadgeCheckIcon className="size-4 text-forest" aria-label="verificada" />}
                </span>
                {cityName && <span className="block text-[13px] text-text-muted">{cityName}</span>}
              </span>
            </Link>
          )}

          <h1 className="mt-5 text-h1 text-text">{g.title}</h1>
          <Price min={g.price_cop} className="mt-2 block text-2xl" />

          {categories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-2">
              {categories.map((c) => (
                <Chip key={c.name} variant="tag">
                  {c.name}
                </Chip>
              ))}
            </div>
          )}

          {g.description && <p className="mt-4 text-[15px] leading-6 text-text">{g.description}</p>}
          {meta && <p className="mt-3 text-sm text-text-muted">{meta}</p>}

          {sizes.length > 0 && (
            <div className="mt-5">
              <p className="mb-1 text-label text-text">Tallas</p>
              <div className="flex flex-wrap gap-x-2">
                {sizes.map((s) => (
                  <Chip key={s.label} variant="tag">
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Escritorio: acciones en línea. */}
          <div className="mt-6 hidden items-center gap-2 md:flex">
            <Button size="lg" className="flex-1" render={<a href={outHref} target="_blank" rel="nofollow noopener noreferrer" />} nativeButton={false}>
              Ir a la tienda <ArrowUpRightIcon data-icon="inline-end" />
            </Button>
            {actions}
          </div>
        </div>
      </div>

      <SimilarGarments garmentId={g.id} isLoggedIn={isLoggedIn} />

      {/* Celular: barra fija sobre la barra de navegación (FR-020). */}
      <StickyActionBar stackAboveNav className="md:hidden">
        <Button size="lg" className="flex-1" render={<a href={outHref} target="_blank" rel="nofollow noopener noreferrer" />} nativeButton={false}>
          Ir a la tienda <ArrowUpRightIcon data-icon="inline-end" />
        </Button>
        {actions}
      </StickyActionBar>
    </div>
  );
}

function PageHeaderBack() {
  return (
    <Link
      href="/feed"
      className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-action-text hover:underline"
    >
      <ArrowLeftIcon className="size-4" aria-hidden /> Volver al feed
    </Link>
  );
}
