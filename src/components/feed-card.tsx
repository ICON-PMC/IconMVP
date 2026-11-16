import type { FeedItem } from "@/lib/feed";
import type { FeedCardProps } from "@/components/cards/card-props";
import { GarmentFeedCard } from "@/components/cards/garment-feed-card";
import { LookCard } from "@/components/cards/look-card";

// Alto/ancho de la imagen acotado: se conserva la proporción real (estilo Pinterest)
// pero sin extremos, para que la grilla no se descuadre con fotos muy altas o muy bajas.
const MIN_RATIO = 0.9;
const MAX_RATIO = 1.45;
const DEFAULT_RATIO = 1.25;

export function cardRatio(item: Pick<FeedItem, "image_width" | "image_height">) {
  if (!item.image_width || !item.image_height) return DEFAULT_RATIO;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, item.image_height / item.image_width));
}

// Tarjeta del feed mixto (spec 007): elige la tarjeta de PRENDA o la de LOOK según `item.kind`.
// Se conserva este punto de entrada para no tocar a quienes la usan (FeedGrid, búsqueda por foto…).
export function FeedCard(props: FeedCardProps) {
  const ratio = cardRatio(props.item);
  return props.item.kind === "post" ? (
    <LookCard {...props} ratio={ratio} />
  ) : (
    <GarmentFeedCard {...props} ratio={ratio} />
  );
}
