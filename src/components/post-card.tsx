import Link from "next/link";
import type { Views } from "@/lib/database.types";
import { priceLabel } from "@/lib/taxonomy";
import { imageUrl } from "@/lib/images";

// Tarjeta del feed masonry. La imagen es un cf_image_id; por ahora es una URL directa
// (placeholder). Al integrar Cloudflare, aquí se armará la URL desde el id.
export function PostCard({ post }: { post: Views<"post_feed"> }) {
  const price = priceLabel(post.min_price, post.max_price);
  const chips = [...post.occasions, ...post.styles].slice(0, 4);
  const img = imageUrl(post.image);

  return (
    <article className="mb-4 break-inside-avoid">
      <Link
        href={`/post/${post.id}`}
        className="block glass overflow-hidden rounded-2xl transition hover:opacity-95"
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
        <div className="p-3">
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
    </article>
  );
}
