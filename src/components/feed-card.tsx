import Link from "next/link";
import type { FeedItem } from "@/lib/feed";
import { priceLabel } from "@/lib/taxonomy";
import { imageUrl } from "@/lib/images";
import { SaveButton } from "@/components/save-button";

const KIND_LABEL: Record<FeedItem["kind"], string> = {
  post: "Outfit",
  garment: "Prenda",
};

// Tarjeta única para el feed mixto: mismo layout para posts (outfits) y prendas,
// distinguidos con una insignia sutil. `tagNames` mapea slug -> nombre (grupo 8:
// nunca mostrar el slug crudo en UI).
export function FeedCard({
  item,
  tagNames,
  saved = false,
  path = "/feed",
}: {
  item: FeedItem;
  tagNames: Record<string, string>;
  saved?: boolean;
  path?: string;
}) {
  const href = item.kind === "post" ? `/post/${item.id}` : `/prenda/${item.id}`;
  const price = priceLabel(item.min_price, item.max_price);
  const img = imageUrl(item.image);
  const aspect =
    item.image_width && item.image_height
      ? `${item.image_width} / ${item.image_height}`
      : "4 / 5";
  const tags = [...item.occasions, ...item.styles]
    .map((slug) => tagNames[slug] ?? slug)
    .slice(0, 3);

  return (
    <article className="relative mb-4 break-inside-avoid">
      <SaveButton kind={item.kind} id={item.id} saved={saved} path={path} floating />
      <Link
        href={href}
        className="block glass overflow-hidden rounded-2xl transition hover:opacity-95"
      >
        <div className="relative w-full overflow-hidden bg-white/40" style={{ aspectRatio: aspect }}>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={item.title ?? item.brand_name}
              loading="lazy"
              className="block h-full w-full object-cover"
            />
          )}
          <span className="absolute left-2 top-2 rounded-full bg-ink/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            {KIND_LABEL[item.kind]}
          </span>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-sm font-medium text-forest">
              {item.brand_name}
              {item.brand_verified && (
                <span title="Verificada por el equipo" aria-label="verificada">
                  ✓
                </span>
              )}
            </span>
            {price && <span className="text-sm text-ink/70">{price}</span>}
          </div>
          {item.kind === "garment" && item.title && (
            <p className="mt-0.5 text-sm text-ink/80">{item.title}</p>
          )}
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
    </article>
  );
}
