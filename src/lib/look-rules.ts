// Reglas y tipos de looks de usuarios (spec 008) sin dependencias de servidor: los usan tanto el
// servidor (src/lib/looks.ts) como los componentes del editor.

export const LOOK_LIMITS = { photos: 4, styles: 6, occasions: 3, items: 10, caption: 500 } as const;

export type LookGarment = {
  itemId: string;
  garmentId: string;
  title: string;
  brandName: string | null;
  brandSlug: string | null;
  image: string | null;
  priceCop: number | null;
  verified: boolean;
  color: string | null;
  size: string | null;
  /** false si la prenda ya no está publicada (el autor la ve; el público no). */
  available: boolean;
};
export type LookProposed = {
  itemId: string;
  id: string;
  name: string;
  categoryName: string;
  colors: string[];
  brandLabel: string | null;
  brandSlug: string | null;
};
export type LookMention = {
  id: string;
  kind: "brand" | "stub";
  targetId: string;
  name: string;
  slug: string | null;
  blocked: boolean;
};
export type LookImage = { id: string; key: string; position: number; width: number | null; height: number | null };
export type LookTag = { id: string; name: string; slug: string; type: "style" | "occasion" | "temperature" };

export type LookDraft = {
  id: string;
  status: "draft" | "published" | "archived";
  caption: string | null;
  moderationLocked: boolean;
  hiddenReason: string | null;
  images: LookImage[];
  garments: LookGarment[];
  proposed: LookProposed[];
  mentions: LookMention[];
  styleIds: string[];
  occasionIds: string[];
  tags: LookTag[];
};

export type MissingPart = "photo" | "item" | "style" | "occasion";
export const MISSING_LABEL: Record<MissingPart, string> = {
  photo: "Agrega al menos una foto",
  item: "Etiqueta al menos una prenda o una marca",
  style: "Elige al menos un estilo",
  occasion: "Elige al menos una ocasión",
};

/** Qué falta para publicar; lista vacía = listo. Mismo criterio que `protect_post_status()`. */
/** Versión corta para la barra de publicar. */
export const MISSING_SHORT: Record<MissingPart, string> = {
  photo: "una foto",
  item: "una prenda o marca",
  style: "un estilo",
  occasion: "una ocasión",
};

export function missingToPublish(look: Pick<LookDraft, "images" | "garments" | "proposed" | "mentions" | "styleIds" | "occasionIds">): MissingPart[] {
  const out: MissingPart[] = [];
  if (!look.images.length) out.push("photo");
  if (!look.garments.length && !look.proposed.length && !look.mentions.length) out.push("item");
  if (!look.styleIds.length) out.push("style");
  if (!look.occasionIds.length) out.push("occasion");
  return out;
}


export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
