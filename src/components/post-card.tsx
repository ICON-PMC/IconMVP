import Link from "next/link";
import type { Views } from "@/lib/database.types";
import { priceLabel } from "@/lib/taxonomy";
import { R2Image, SIZES } from "@/components/r2-image";
import { SaveButton } from "@/components/save-button";
import { LikeButton } from "@/components/like-button";

export function PostCard({
  post,
  saved = false,
  liked = false,
  likeCount,
  isLoggedIn = false,
  path = "/feed",
  tagNames = {},
}: {
  post: Views<"post_feed">;
  saved?: boolean;
  liked?: boolean;
  likeCount?: number;
  isLoggedIn?: boolean;
  path?: string;
  tagNames?: Record<string, string>;
}) {
  const price = priceLabel(post.min_price, post.max_price);
  const chips = [...post.occasions, ...post.styles]
    .map((slug) => tagNames[slug] ?? slug)
    .slice(0, 4);

  // Spec 007: mismo aspecto que la tarjeta de look del feed (foto a todo el alto, datos encima).
  return (
    <article className="mb-5 break-inside-avoid">
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-surface-inverse">
        <Link href={`/post/${post.id}`} className="block" aria-label={post.caption ?? `Look de ${post.brand_name ?? "Icon"}`}>
          <R2Image image={post.image} alt={post.caption ?? post.brand_name ?? ""} sizes={SIZES.card} className="block aspect-[4/5] w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 via-ink/30 to-transparent px-3 pt-14 pb-3 text-text-inverse">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold">{post.brand_name}</span>
              {price && <span className="text-[13px] font-semibold">{price}</span>}
            </span>
            {chips.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {chips.slice(0, 2).map((c) => (
                  <span key={c} className="rounded-full border border-text-inverse/70 px-2.5 py-1 text-[11px] font-semibold">
                    {c}
                  </span>
                ))}
              </span>
            )}
          </span>
        </Link>
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <SaveButton kind="post" id={post.id} saved={saved} path={path} compact />
          <LikeButton itemId={post.id} initialLiked={liked} initialCount={likeCount ?? post.like_count} path={path} isLoggedIn={isLoggedIn} compact />
        </div>
      </div>
    </article>
  );
}
