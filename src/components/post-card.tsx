import Link from "next/link";
import type { Views } from "@/lib/database.types";
import { priceLabel } from "@/lib/taxonomy";
import { imageUrl } from "@/lib/images";
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
  const img = imageUrl(post.image);

  return (
    <article className="mb-4 break-inside-avoid">
      <div className="glass overflow-hidden rounded-2xl">
        <Link
          href={`/post/${post.id}`}
          className="block transition hover:opacity-95"
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={post.caption ?? post.brand_name}
              loading="lazy"
              className="block w-full"
            />
          )}
          <div className="p-3 pb-1">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-sm font-medium text-forest">
                {post.brand_name}
                {post.brand_verified && (
                  <span title="Verificada por el equipo" aria-label="verificada">
                    ✓
                  </span>
                )}
              </span>
              {price && <span className="text-sm text-ink/70">{price}</span>}
            </div>
            {post.city_name && (
              <p className="mt-0.5 text-xs text-ink/50">{post.city_name}</p>
            )}
            {chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {chips.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-white/50 px-2 py-0.5 text-[11px] text-forest-deep"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Link>
        {/* Fila de acciones al pie: guardar y like juntos, y FUERA del <Link> (un
            <button> dentro de un <a> es HTML inválido y el clic navegaría). Con
            justify-between + gap quedan separados en los extremos; al no haber ya
            botón flotante sobre la imagen, no pueden superponerse. */}
        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <SaveButton kind="post" id={post.id} saved={saved} path={path} />
          <LikeButton
            postId={post.id}
            initialLiked={liked}
            initialCount={likeCount ?? post.like_count}
            path={path}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </div>
    </article>
  );
}

