import Link from "next/link";
import type { FeedItem } from "@/lib/feed";
import { priceLabel } from "@/lib/taxonomy";
import { imageUrl } from "@/lib/images";
import { SaveButton } from "@/components/save-button";
import { LikeButton } from "@/components/like-button";

// Alto/ancho de la imagen acotado: se conserva la proporción real (estilo Pinterest)
// pero sin extremos, para que la grilla no se descuadre con fotos muy altas o muy bajas.
const MIN_RATIO = 0.9;
const MAX_RATIO = 1.45;
const DEFAULT_RATIO = 1.25;

export function cardRatio(item: Pick<FeedItem, "image_width" | "image_height">) {
  if (!item.image_width || !item.image_height) return DEFAULT_RATIO;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, item.image_height / item.image_width));
}

// Tarjeta única para el feed mixto: mismo layout para posts (outfits) y prendas,
// distinguidos con una insignia sutil. `tagNames` mapea slug -> nombre (grupo 8:
// nunca mostrar el slug crudo en UI).
export function FeedCard({
  item,
  tagNames,
  saved = false,
  liked = false,
  isLoggedIn = false,
  path = "/feed",
}: {
  item: FeedItem;
  tagNames: Record<string, string>;
  saved?: boolean;
  liked?: boolean;
  isLoggedIn?: boolean;
  path?: string;
}) {
  const href = item.kind === "post" ? `/post/${item.id}` : `/prenda/${item.id}`;
  const price = priceLabel(item.min_price, item.max_price);
  const img = imageUrl(item.image);
  const ratio = cardRatio(item);
  const tags = [...item.occasions, ...item.styles]
    .map((slug) => tagNames[slug] ?? slug)
    .slice(0, 3);

  return (
    <article className="mb-4 break-inside-avoid">
      <div className="glass transform-gpu overflow-hidden rounded-2xl">
        <div className="relative w-full overflow-hidden bg-white/40" style={{ aspectRatio: `1 / ${ratio}` }}>
          <Link href={href} aria-label={item.title ?? item.brand_name} className="absolute inset-0 block">
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={item.title ?? item.brand_name}
                loading="lazy"
                className="block h-full w-full object-cover"
              />
            )}
          </Link>
          {/* Acciones sobre la imagen, fuera del <Link> (un <button> dentro de un <a> es HTML
              inválido y el clic navegaría). */}
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between">
            <div className="pointer-events-auto">
              <SaveButton kind={item.kind} id={item.id} saved={saved} path={path} compact />
            </div>
            <div className="pointer-events-auto">
              <LikeButton
                kind={item.kind}
                itemId={item.id}
                initialLiked={liked}
                initialCount={item.like_count}
                path={path}
                isLoggedIn={isLoggedIn}
                compact
              />
            </div>
          </div>
        </div>
        <Link href={href} className="block p-3">
          {/* Móvil: solo el nombre del look o la prenda. Desde md: marca, precio, ciudad y etiquetas. */}
          <p className="line-clamp-2 text-sm font-medium text-forest">
            {item.title ?? item.brand_name}
          </p>
          <div className="mt-1 hidden md:block">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-sm text-ink/80">
                {item.brand_name}
                {item.brand_verified && (
                  <span title="Verificada por el equipo" aria-label="verificada">
                    ✓
                  </span>
                )}
              </span>
              {price && <span className="text-sm text-ink/70">{price}</span>}
            </div>
            {item.city_name && <p className="mt-0.5 text-xs text-ink/50">{item.city_name}</p>}
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white/50 px-2 py-0.5 text-[11px] text-forest-deep"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Link>
      </div>
    </article>
  );
}
