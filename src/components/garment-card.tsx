import Link from "next/link";
import { Price } from "@/components/price";
import { R2Image, SIZES } from "@/components/r2-image";
import { SaveButton } from "@/components/save-button";
import { LikeButton } from "@/components/like-button";

export function GarmentCard({
  id,
  title,
  price_cop,
  image,
  saved = false,
  liked = false,
  likeCount = 0,
  isLoggedIn = false,
  path = "/feed",
  sourcePostId,
}: {
  id: string;
  title: string;
  price_cop: number | null;
  image: string | null;
  saved?: boolean;
  liked?: boolean;
  likeCount?: number;
  isLoggedIn?: boolean;
  path?: string;
  sourcePostId?: string;
}) {
  // Spec 007: mismo aspecto que la tarjeta de prenda del feed (foto 20 px, datos debajo).
  return (
    <article className="break-inside-avoid">
      <div className="relative overflow-hidden rounded-[var(--radius-photo)] bg-surface-sunken">
        <Link href={`/prenda/${id}`} className="block" aria-label={title}>
          {image ? (
            <R2Image image={image} alt={title} sizes={SIZES.card} className="block aspect-[3/4] w-full object-cover" />
          ) : (
            <span className="flex aspect-[3/4] w-full items-end bg-leaf-soft p-3 text-h3 text-text">{title}</span>
          )}
        </Link>
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between">
          <div className="pointer-events-auto">
            <SaveButton kind="garment" id={id} saved={saved} path={path} sourcePostId={sourcePostId} compact />
          </div>
          <div className="pointer-events-auto">
            <LikeButton kind="garment" itemId={id} initialLiked={liked} initialCount={likeCount} path={path} isLoggedIn={isLoggedIn} compact />
          </div>
        </div>
      </div>
      <Link href={`/prenda/${id}`} className="mt-2 block px-0.5">
        <p className="truncate text-sm font-semibold text-text">{title}</p>
        <Price min={price_cop} className="text-sm" />
      </Link>
    </article>
  );
}
