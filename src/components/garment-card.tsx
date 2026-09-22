import Link from "next/link";
import { formatCop } from "@/lib/taxonomy";
import { imageUrl } from "@/lib/images";
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
  const img = imageUrl(image);
  return (
    <article className="break-inside-avoid">
      <div className="glass overflow-hidden rounded-2xl">
        <Link
          href={`/prenda/${id}`}
          className="block transition hover:opacity-95"
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={title}
              loading="lazy"
              className="block aspect-[3/4] w-full object-cover"
            />
          )}
          <div className="p-3 pb-1">
            <p className="text-sm font-medium text-forest">{title}</p>
            {price_cop != null && (
              <p className="text-sm text-ink/70">{formatCop(price_cop)}</p>
            )}
          </div>
        </Link>
        {/* Fila de acciones al pie: fuera del <Link> (un <button> dentro de un <a> es HTML
            inválido) y sin flotante, para que guardar y like no se superpongan. Mismo
            patrón que PostCard y FeedCard. */}
        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <SaveButton
            kind="garment"
            id={id}
            saved={saved}
            path={path}
            sourcePostId={sourcePostId}
          />
          <LikeButton
            kind="garment"
            itemId={id}
            initialLiked={liked}
            initialCount={likeCount}
            path={path}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </div>
    </article>
  );
}

