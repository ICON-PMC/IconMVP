import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { LikeButton } from "@/components/like-button";
import { R2Image, SIZES } from "@/components/r2-image";
import { SaveButton } from "@/components/save-button";
import { cardHref, type FeedCardProps } from "./card-props";

/**
 * Tarjeta de LOOK (spec 007, D4): foto a todo el alto con esquinas de 24 px y degradado inferior
 * con quien lo publica y hasta 2 etiquetas. Guardar y like arriba a la derecha.
 */
export function LookCard({
  item,
  tagNames,
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
  const author = item.brand_name ?? "Icon";
  const tags = [...item.occasions, ...item.styles].map((slug) => tagNames[slug] ?? slug).slice(0, 2);
  return (
    <article className="mb-5 break-inside-avoid">
      <div
        className="relative w-full overflow-hidden rounded-[var(--radius-card)] bg-surface-inverse"
        style={{ aspectRatio: `1 / ${ratio}` }}
      >
        <Link href={href} prefetch={prefetch} aria-label={item.title ?? `Look de ${author}`} className="absolute inset-0 block">
          {item.image && (
            <R2Image image={item.image} alt={item.title ?? `Look de ${author}`} sizes={SIZES.card} priority={priority} className="block size-full object-cover" />
          )}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 via-ink/30 to-transparent px-3 pt-14 pb-3 text-text-inverse">
            <span className="flex items-center gap-2">
              <Avatar image={null} name={author} seed={item.brand_id ?? item.id} size={24} />
              <span className="truncate text-[13px] font-semibold">{author}</span>
            </span>
            {tags.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="rounded-full border border-text-inverse/70 px-2.5 py-1 text-[11px] font-semibold">
                    {t}
                  </span>
                ))}
              </span>
            )}
          </span>
        </Link>
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <SaveButton kind="post" id={item.id} saved={saved} path={path} compact />
          <LikeButton kind="post" itemId={item.id} initialLiked={liked} initialCount={item.like_count} path={path} isLoggedIn={isLoggedIn} compact />
        </div>
      </div>
    </article>
  );
}
