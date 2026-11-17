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
  /** Reportes de reseñas (spec 011). */
  rating?: { stars: number; body: string; brandName: string; brandSlug: string | null; author: string; status: string } | null;
};

export type CommunityData = {
  stubs: { id: string; name: string; status: string; mentions: number; createdAt: string }[];
  proposed: { id: string; name: string; category: string; brand: string | null; postId: string | null; createdAt: string }[];
  blocked: { id: string; label: string; reason: string | null; since: string }[];
  /** Perfiles ocultos por el equipo (spec 009). */
  hiddenProfiles: { id: string; handle: string; label: string; reason: string | null; since: string }[];
  /** Spec 010: marcas activas (para asignar), solicitudes por prendas sin marca, enlaces recientes y registro. */
  brands: { id: string; name: string }[];
  requests: { id: string; name: string; brand: string; at: string }[];
  recentLinks: { id: string; name: string; brand: string | null; at: string }[];
  events: { id: string; action: string; label: string; actor: string | null; at: string }[];
};

export const CLAIM_ACTION_LABEL: Record<string, string> = {
  review_accept: "Confirmó un look",
  review_decline: "Rechazó un look",
  link_proposed: "Enlazó una prenda propuesta",
  convert_proposed: "Empezó a agregar una prenda propuesta",
  converted_published: "Publicó una prenda propuesta",
  disown_proposed: "Dijo que una prenda no es suya",
  request_proposed: "Pidió una prenda sin marca",
  approve_request: "Aprobó una solicitud",
  reject_request: "Rechazó una solicitud",
  assign_proposed: "Asignó una prenda a una marca",
  merge_proposed: "Unificó prendas propuestas",
  discard_proposed: "Descartó una prenda propuesta",
  unlink_proposed: "Deshizo un enlace",
  claim_stub: "Asignó una marca mencionada",
  merge_stubs: "Unificó marcas mencionadas",
};

