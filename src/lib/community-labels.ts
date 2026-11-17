// Tipos y etiquetas de las colas del equipo (spec 008), sin dependencias de servidor.

export const REASON_LABEL: Record<string, string> = {
  not_fashion: "No es moda",
  offensive: "Contenido ofensivo",
  spam: "Spam o publicidad",
  stolen_photo: "Usa fotos de otra persona",
  other: "Otro",
};

export type ReportGroup = {
  targetType: "post" | "profile" | "brand_review" | "proposed_garment";
  targetId: string;
  count: number;
  reasons: { reason: string; n: number }[];
  notes: string[];
  firstAt: string;
  /** Vista previa cuando el objetivo es un look. */
  post: {
    id: string;
    image: string | null;
    caption: string | null;
    status: string;
    hiddenReason: string | null;
    author: string;
    authorUserId: string | null;
  } | null;
  label: string;
  /** Reportes de perfil (spec 009): el @usuario para enlazar al perfil. */
  profileHandle?: string | null;
};

export type CommunityData = {
  stubs: { id: string; name: string; status: string; mentions: number; createdAt: string }[];
  proposed: { id: string; name: string; category: string; brand: string | null; postId: string | null; createdAt: string }[];
  blocked: { id: string; label: string; reason: string | null; since: string }[];
  /** Perfiles ocultos por el equipo (spec 009). */
  hiddenProfiles: { id: string; handle: string; label: string; reason: string | null; since: string }[];
};

