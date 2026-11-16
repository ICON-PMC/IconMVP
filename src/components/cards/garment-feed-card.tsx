import Link from "next/link";
import { BadgeCheckIcon } from "lucide-react";
import { LikeButton } from "@/components/like-button";
import { Price } from "@/components/price";
import { R2Image, SIZES } from "@/components/r2-image";
import { SaveButton } from "@/components/save-button";
import { cardHref, type FeedCardProps } from "./card-props";

/**
 * Tarjeta de PRENDA (spec 007, D4): foto con esquinas de 20 px y, debajo, nombre, marca y precio.
 * Se distingue del look (foto a todo el alto con los datos encima) sin leer el texto.
 */
export function GarmentFeedCard({
  item,
  saved = false,
  liked = false,
  isLoggedIn = false,
  path = "/feed",
  from,
  priority = false,
  prefetch,
  ratio,
}: FeedCardProps & { ratio: number }) {
  const href = cardHref(item, from);
  const name = item.title ?? item.brand_name ?? "Prenda";
  return (
    <article className="mb-4 break-inside-avoid">
      <div
        className="relative w-full overflow-hidden rounded-[var(--radius-photo)] bg-surface-sunken"
        style={{ aspectRatio: `1 / ${ratio}` }}
      >
        <Link href={href} prefetch={prefetch} aria-label={name} className="absolute inset-0 block">
          {item.image ? (
            <R2Image image={item.image} alt={name} sizes={SIZES.card} priority={priority} className="block size-full object-cover" />
          ) : (
            <span className="flex size-full items-end bg-leaf-soft p-3 text-h3 text-text">{name}</span>
          )}
        </Link>
        {/* Acciones fuera del <Link>: un <button> dentro de un <a> es HTML inválido. */}
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between">
          <div className="pointer-events-auto">
            <SaveButton kind="garment" id={item.id} saved={saved} path={path} compact />
          </div>
          <div className="pointer-events-auto">
            <LikeButton kind="garment" itemId={item.id} initialLiked={liked} initialCount={item.like_count} path={path} isLoggedIn={isLoggedIn} compact />
          </div>
        </div>
      </div>
      {/* Board (ajuste de la dueña): una línea de nombre y una línea discreta de marca y precio. */}
      <Link href={href} prefetch={prefetch} className="mt-1.5 block px-1">
        <p className="truncate text-[13px] font-semibold leading-5 text-text">{name}</p>
        <p className="flex items-center gap-1 truncate text-xs leading-4 text-text-muted">
          <span className="truncate">{item.brand_name}</span>
          {item.brand_verified && <BadgeCheckIcon className="size-3 shrink-0 text-forest" aria-label="verificada" />}
          {item.min_price != null && (
            <>
              <span aria-hidden>·</span>
              <Price min={item.min_price} max={item.max_price} className="font-semibold text-text-muted" />
            </>
          )}
        </p>
      </Link>
    </article>
  );
}
