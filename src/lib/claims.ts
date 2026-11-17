import { createClient } from "@/lib/supabase/server";
import { getPublicProfiles, type PublicProfile } from "@/lib/profiles";

// Bandeja de menciones de una marca y estados de etiquetas para el autor (spec 010, contracts §1).
// Las lecturas pasan por RLS: la marca ve sus revisiones y propuestas; el autor, las de sus looks.

const PAGE = 24;

export type InboxCounts = { reviewsPending: number; proposedPending: number; unbrandedOpen: number };

export async function getInboxCounts(brandId: string): Promise<InboxCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_brand_inbox_counts", { p_brand_id: brandId });
  if (error || !data) return { reviewsPending: 0, proposedPending: 0, unbrandedOpen: 0 };
  const d = data as { reviews_pending: number; proposed_pending: number; unbranded_open: number };
  return { reviewsPending: d.reviews_pending, proposedPending: d.proposed_pending, unbrandedOpen: d.unbranded_open };
}

export type ReviewStatus = "pending" | "accepted" | "declined";

export type ReviewItem = {
  postId: string;
  publishedAt: string | null;
  image: string | null;
  author: PublicProfile | null;
  garments: { garmentId: string; title: string; image: string | null }[];
  mentioned: boolean;
  status: ReviewStatus;
  note: string | null;
};

async function firstImages(supabase: Awaited<ReturnType<typeof createClient>>, table: "post_images" | "garment_images", ids: string[]) {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  if (table === "post_images") {
    const { data } = await supabase.from("post_images").select("post_id, cf_image_id, position").in("post_id", ids).order("position");
    for (const r of data ?? []) if (!map.has(r.post_id)) map.set(r.post_id, r.cf_image_id);
  } else {
    const { data } = await supabase.from("garment_images").select("garment_id, cf_image_id, position").in("garment_id", ids).order("position");
    for (const r of data ?? []) if (!map.has(r.garment_id)) map.set(r.garment_id, r.cf_image_id);
  }
  return map;
}

/** "pending" = por revisar; "reviewed" = aceptadas y rechazadas. */
export async function getReviewInbox(
  brandId: string,
  filter: "pending" | "reviewed",
  offset = 0,
): Promise<{ items: ReviewItem[]; nextOffset: number | null }> {
  const supabase = await createClient();
  let q = supabase
    .from("post_brand_reviews")
    .select("post_id, status, note, created_at, updated_at")
    .eq("brand_id", brandId)
    .order(filter === "pending" ? "created_at" : "updated_at", { ascending: false })
    .range(offset, offset + PAGE - 1);
  q = filter === "pending" ? q.eq("status", "pending") : q.neq("status", "pending");
  const { data: reviews } = await q;
  const ids = (reviews ?? []).map((r) => r.post_id);
  if (!ids.length) return { items: [], nextOffset: null };

  const [{ data: posts }, images, { data: items }, { data: mentions }] = await Promise.all([
    supabase.from("posts").select("id, published_at, author_user_id, status").in("id", ids),
    firstImages(supabase, "post_images", ids),
    supabase.from("post_items").select("post_id, garment_id, garments!inner(id, title, brand_id)").in("post_id", ids).eq("garments.brand_id", brandId),
    supabase.from("post_brand_mentions").select("post_id").in("post_id", ids).eq("brand_id", brandId),
  ]);
  const garmentIds = [...new Set((items ?? []).map((i) => i.garment_id))];
  const [gImages, profiles] = await Promise.all([
    firstImages(supabase, "garment_images", garmentIds),
    getPublicProfiles((posts ?? []).flatMap((p) => (p.author_user_id ? [p.author_user_id] : []))),
  ]);
  const mentioned = new Set((mentions ?? []).map((m) => m.post_id));

  const out: ReviewItem[] = [];
  for (const r of reviews ?? []) {
    const p = (posts ?? []).find((x) => x.id === r.post_id);
    if (!p || p.status !== "published") continue;
    out.push({
      postId: r.post_id,
      publishedAt: p.published_at,
      image: images.get(r.post_id) ?? null,
      author: p.author_user_id ? (profiles.get(p.author_user_id) ?? null) : null,
      garments: (items ?? [])
        .filter((i) => i.post_id === r.post_id)
        .map((i) => {
          const g = i.garments as unknown as { id: string; title: string };
          return { garmentId: g.id, title: g.title, image: gImages.get(g.id) ?? null };
        }),
      mentioned: mentioned.has(r.post_id),
      status: r.status as ReviewStatus,
      note: r.note,
    });
  }
  return { items: out, nextOffset: (reviews ?? []).length === PAGE ? offset + PAGE : null };
}

export type ProposedItem = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  colors: { name: string; hex: string | null }[];
  looks: { postId: string; image: string | null }[];
  usedIn: number;
  conversionGarmentId: string | null;
  /** Solicitud pendiente de esta marca (prendas sin marca). */
  requested: boolean;
  /** Otra marca ya la pidió. */
  requestedByOther: boolean;
};

export async function getProposedInbox(
  brandId: string,
  scope: "mine" | "unbranded",
  offset = 0,
  categoryId?: string,
): Promise<{ items: ProposedItem[]; nextOffset: number | null }> {
  const supabase = await createClient();
  let q = supabase
    .from("proposed_garments")
    .select("id, name, category_tag_id, claimed_garment_id, claim_requested_brand_id")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE - 1);
  q = scope === "mine" ? q.eq("brand_id", brandId) : q.is("brand_id", null).is("brand_stub_id", null);
  if (categoryId) q = q.eq("category_tag_id", categoryId);
  const { data: rows } = await q;
  const ids = (rows ?? []).map((r) => r.id);
  if (!ids.length) return { items: [], nextOffset: null };

  const [{ data: links }, { data: cats }, { data: colors }] = await Promise.all([
    supabase.from("post_proposed_items").select("proposed_garment_id, post_id").in("proposed_garment_id", ids),
    supabase.from("tags").select("id, name").in("id", [...new Set((rows ?? []).map((r) => r.category_tag_id))]),
    supabase.from("proposed_garment_colors").select("proposed_garment_id, colors(name, hex)").in("proposed_garment_id", ids),
  ]);
  const postIds = [...new Set((links ?? []).map((l) => l.post_id))];
  const images = await firstImages(supabase, "post_images", postIds);

  const items: ProposedItem[] = (rows ?? []).map((r) => {
    const looks = (links ?? []).filter((l) => l.proposed_garment_id === r.id);
    return {
      id: r.id,
      name: r.name,
      categoryId: r.category_tag_id,
      categoryName: (cats ?? []).find((c) => c.id === r.category_tag_id)?.name ?? "",
      colors: (colors ?? [])
        .filter((c) => c.proposed_garment_id === r.id)
        .map((c) => c.colors as unknown as { name: string; hex: string | null }),
      looks: looks.slice(0, 4).map((l) => ({ postId: l.post_id, image: images.get(l.post_id) ?? null })),
      usedIn: looks.length,
      conversionGarmentId: r.claimed_garment_id,
      requested: r.claim_requested_brand_id === brandId,
      requestedByOther: !!r.claim_requested_brand_id && r.claim_requested_brand_id !== brandId,
    };
  });
  return { items, nextOffset: (rows ?? []).length === PAGE ? offset + PAGE : null };
}

/** Prendas publicadas de la marca, para "Es esta de mi catálogo". */
export async function getBrandPublishedGarments(brandId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("garments")
    .select("id, title, price_cop")
    .eq("brand_id", brandId)
    .eq("status", "published")
    .order("title");
  const images = await firstImages(supabase, "garment_images", (data ?? []).map((g) => g.id));
  return (data ?? []).map((g) => ({ id: g.id, title: g.title, priceCop: g.price_cop, image: images.get(g.id) ?? null }));
}

export type LookTagStatus = {
  reviews: { brandId: string; brandName: string; status: ReviewStatus }[];
  notes: { text: string; createdAt: string }[];
  /** garment_id de prendas que llegaron por una propuesta reclamada. */
  convertedGarments: string[];
};

/** Estado de cada etiqueta de un look propio, para el editor del autor (US5). */
export async function getLookTagStatus(postId: string): Promise<LookTagStatus> {
  const supabase = await createClient();
  const [{ data: reviews }, { data: notes }, { data: items }] = await Promise.all([
    supabase.from("post_brand_reviews").select("brand_id, status, brands(name)").eq("post_id", postId),
    supabase.from("post_tag_notes").select("text, created_at").eq("post_id", postId).order("created_at", { ascending: false }),
    supabase.from("post_items").select("garment_id").eq("post_id", postId),
  ]);
  const gids = (items ?? []).map((i) => i.garment_id);
  const { data: claimed } = gids.length
    ? await supabase.from("proposed_garments").select("claimed_garment_id").eq("status", "claimed").in("claimed_garment_id", gids)
    : { data: [] as { claimed_garment_id: string | null }[] };
  return {
    reviews: (reviews ?? []).map((r) => ({
      brandId: r.brand_id,
      brandName: (r.brands as unknown as { name: string } | null)?.name ?? "",
      status: r.status as ReviewStatus,
    })),
    notes: (notes ?? []).map((n) => ({ text: n.text, createdAt: n.created_at })),
    convertedGarments: (claimed ?? []).flatMap((c) => (c.claimed_garment_id ? [c.claimed_garment_id] : [])),
  };
}
