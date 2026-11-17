import type { FeedItem } from "@/lib/feed";

/** Props comunes de las tarjetas del feed (spec 007, contracts §3). */
export type FeedCardProps = {
  item: FeedItem;
  tagNames: Record<string, string>;
  saved?: boolean;
  liked?: boolean;
  isLoggedIn?: boolean;
  path?: string;
  /** Origen para atribuir el clic saliente en la ficha (búsqueda por foto, "más como esta"). */
  from?: "photo_search" | "similar";
  /** Primeras tarjetas de la pantalla: la foto se pide de inmediato y con prioridad (spec 006). */
  priority?: boolean;
  /** false con ahorro de datos: no precargar la ficha (spec 006). */
  prefetch?: boolean;
};

export function cardHref(item: FeedItem, from?: string) {
  const base = item.kind === "post" ? `/post/${item.id}` : `/prenda/${item.id}`;
  return from ? `${base}?from=${from}` : base;
}
