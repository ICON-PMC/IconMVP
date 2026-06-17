import Link from "next/link";
import { formatCop } from "@/lib/taxonomy";
import { imageUrl } from "@/lib/images";
import { SaveButton } from "@/components/save-button";

export function GarmentCard({
  id,
  title,
  price_cop,
  image,
  saved = false,
  path = "/feed",
  sourcePostId,
}: {
  id: string;
  title: string;
  price_cop: number | null;
  image: string | null;
  saved?: boolean;
  path?: string;
  sourcePostId?: string;
}) {
  const img = imageUrl(image);
  return (
    <article className="relative">
      <SaveButton
        kind="garment"
        id={id}
        saved={saved}
        path={path}
        sourcePostId={sourcePostId}
        floating
      />
      <Link
        href={`/prenda/${id}`}
        className="block glass overflow-hidden rounded-2xl transition hover:opacity-95"
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
        <div className="p-3">
          <p className="text-sm font-medium text-forest">{title}</p>
          {price_cop != null && (
            <p className="text-sm text-ink/70">{formatCop(price_cop)}</p>
          )}
        </div>
      </Link>
    </article>
  );
}
