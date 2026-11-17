import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getPublicProfiles, type PublicProfile } from "@/lib/profiles";
import { isUuid, type LookDraft, type LookGarment, type LookMention, type LookProposed, type LookTag } from "@/lib/look-rules";

export * from "@/lib/look-rules";

// Lecturas de looks de usuarios (spec 008, contracts §3): el editor (`getMyLook`, `getMyDrafts`) y
// la ficha pública (`getLookDetail`, que sirve looks de marca y de usuario).

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type LookAuthor =
  | { kind: "user"; profile: PublicProfile }
  | { kind: "brand"; id: string; name: string; slug: string; logo: string | null; verified: boolean; city: string | null };

export type LookDetail = Omit<LookDraft, "styleIds" | "occasionIds"> & {
  author: LookAuthor | null;
  authorUserId: string | null;
  publishedAt: string | null;
  likeCount: number;
  isMine: boolean;
};

// ── piezas compartidas ──────────────────────────────────────────────────────────────────────

async function readLookParts(supabase: Supabase, postId: string, forAuthor: boolean) {
  const [{ data: images }, { data: items }, { data: proposedRows }, { data: mentionRows }, { data: tagRows }] =
    await Promise.all([
      supabase
        .from("post_images")
        .select("id, cf_image_id, position, width, height")
        .eq("post_id", postId)
        .order("position")
        .order("created_at"),
      supabase.from("post_items").select("id, garment_id, size_id, is_brand_verified, created_at").eq("post_id", postId).order("created_at"),
      supabase.from("post_proposed_items").select("id, proposed_garment_id, position, created_at").eq("post_id", postId).order("created_at"),
      supabase.from("post_brand_mentions").select("id, brand_id, brand_stub_id, created_at").eq("post_id", postId).order("created_at"),
      supabase.from("post_tags").select("tag_id").eq("post_id", postId),
    ]);

  const garmentIds = (items ?? []).map((i) => i.garment_id);
  const proposedIds = (proposedRows ?? []).map((p) => p.proposed_garment_id);
  const mentionBrandIds = (mentionRows ?? []).flatMap((m) => (m.brand_id ? [m.brand_id] : []));
  const stubIds = (mentionRows ?? []).flatMap((m) => (m.brand_stub_id ? [m.brand_stub_id] : []));
  const tagIds = (tagRows ?? []).map((t) => t.tag_id);

  const [{ data: garments }, { data: gImages }, { data: proposed }, { data: pColors }, { data: tags }] = await Promise.all([
    garmentIds.length
      ? supabase.from("garments").select("id, title, price_cop, status, brand_id, color").in("id", garmentIds)
      : Promise.resolve({
          data: [] as { id: string; title: string; price_cop: number | null; status: string; brand_id: string; color: string | null }[],
        }),
    garmentIds.length
      ? supabase.from("garment_images").select("garment_id, cf_image_id, position").in("garment_id", garmentIds).order("position")
      : Promise.resolve({ data: [] as { garment_id: string; cf_image_id: string; position: number }[] }),
    proposedIds.length
      ? supabase.from("proposed_garments").select("id, name, category_tag_id, brand_id, brand_stub_id, status").in("id", proposedIds)
      : Promise.resolve({
          data: [] as { id: string; name: string; category_tag_id: string; brand_id: string | null; brand_stub_id: string | null; status: string }[],
        }),
    proposedIds.length
      ? supabase.from("proposed_garment_colors").select("proposed_garment_id, color_id").in("proposed_garment_id", proposedIds)
      : Promise.resolve({ data: [] as { proposed_garment_id: string; color_id: string }[] }),
    tagIds.length
      ? supabase.from("tags").select("id, name, slug, type").in("id", tagIds).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string; type: string }[] }),
  ]);

  const categoryIds = [...new Set((proposed ?? []).map((p) => p.category_tag_id))];
  const colorIds = [...new Set((pColors ?? []).map((c) => c.color_id))];
  const brandIds = [
    ...new Set([
      ...(garments ?? []).map((g) => g.brand_id),
      ...mentionBrandIds,
      ...(proposed ?? []).flatMap((p) => (p.brand_id ? [p.brand_id] : [])),
    ]),
  ];
  const allStubIds = [...new Set([...stubIds, ...(proposed ?? []).flatMap((p) => (p.brand_stub_id ? [p.brand_stub_id] : []))])];

  const sizeIds = [...new Set((items ?? []).flatMap((i) => (i.size_id ? [i.size_id] : [])))];
  const [{ data: categories }, { data: colors }, { data: brands }, { data: stubs }, { data: sizes }] = await Promise.all([
    categoryIds.length
      ? supabase.from("tags").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    colorIds.length
      ? supabase.from("colors").select("id, name").in("id", colorIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    brandIds.length
      ? supabase.from("brands").select("id, name, slug").in("id", brandIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
    allStubIds.length
      ? supabase.from("brand_stubs").select("id, name").in("id", allStubIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    sizeIds.length
      ? supabase.from("sizes").select("id, label").in("id", sizeIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
  ]);
  const sizeById = new Map((sizes ?? []).map((x) => [x.id, x.label]));

  const garmentById = new Map((garments ?? []).map((g) => [g.id, g]));
  const firstImage = new Map<string, string>();
  for (const gi of gImages ?? []) if (!firstImage.has(gi.garment_id)) firstImage.set(gi.garment_id, gi.cf_image_id);
  const brandById = new Map((brands ?? []).map((b) => [b.id, b]));
  // Una marca mencionada que no se puede leer está bloqueada por el equipo (RLS: status <> 'blocked').
  const stubById = new Map((stubs ?? []).map((s) => [s.id, s]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const colorById = new Map((colors ?? []).map((c) => [c.id, c.name]));
  const proposedById = new Map((proposed ?? []).map((p) => [p.id, p]));

  const lookGarments: LookGarment[] = [];
  for (const it of items ?? []) {
    const g = garmentById.get(it.garment_id);
    const available = Boolean(g && g.status === "published" && brandById.has(g.brand_id));
    if (!available && !forAuthor) continue;
    const b = g ? brandById.get(g.brand_id) : undefined;
    lookGarments.push({
      itemId: it.id,
      garmentId: it.garment_id,
      title: g?.title ?? "Prenda no disponible",
      brandName: b?.name ?? null,
      brandSlug: b?.slug ?? null,
      image: firstImage.get(it.garment_id) ?? null,
      priceCop: g?.price_cop ?? null,
      verified: it.is_brand_verified,
      color: g?.color ?? null,
      size: it.size_id ? (sizeById.get(it.size_id) ?? null) : null,
      available,
    });
  }

  const lookProposed: LookProposed[] = [];
  for (const row of proposedRows ?? []) {
    const p = proposedById.get(row.proposed_garment_id);
    if (!p || (p.status === "rejected" && !forAuthor)) continue;
    const brand = p.brand_id ? brandById.get(p.brand_id) : undefined;
    const stub = p.brand_stub_id ? stubById.get(p.brand_stub_id) : undefined;
    lookProposed.push({
      itemId: row.id,
      id: p.id,
      name: p.name,
      categoryName: categoryById.get(p.category_tag_id) ?? "",
      colors: (pColors ?? []).filter((c) => c.proposed_garment_id === p.id).map((c) => colorById.get(c.color_id) ?? "").filter(Boolean),
      brandLabel: brand?.name ?? stub?.name ?? null,
      brandSlug: brand?.slug ?? null,
    });
  }

  const mentions: LookMention[] = [];
  for (const m of mentionRows ?? []) {
    if (m.brand_id) {
      const b = brandById.get(m.brand_id);
      if (!b) continue; // marca inactiva
      mentions.push({ id: m.id, kind: "brand", targetId: b.id, name: b.name, slug: b.slug, blocked: false });
    } else if (m.brand_stub_id) {
      const s = stubById.get(m.brand_stub_id);
      if (!s && !forAuthor) continue;
      mentions.push({ id: m.id, kind: "stub", targetId: m.brand_stub_id, name: s?.name ?? "Marca bloqueada", slug: null, blocked: !s });
    }
  }

  const lookTags: LookTag[] = (tags ?? [])
    .filter((t) => t.type === "style" || t.type === "occasion" || t.type === "temperature")
    .map((t) => ({ id: t.id, name: t.name, slug: t.slug, type: t.type as LookTag["type"] }));

  return {
    images: (images ?? []).map((i) => ({ id: i.id, key: i.cf_image_id, position: i.position, width: i.width, height: i.height })),
    garments: lookGarments,
    proposed: lookProposed,
    mentions,
    tags: lookTags,
  };
}

// ── editor ───────────────────────────────────────────────────────────────────────────────

/** Look propio para el editor. null si no existe o no es de quien consulta. */
export async function getMyLook(postId: string): Promise<LookDraft | null> {
  const session = await getCurrentUser();
  const me = session?.profile?.id;
  if (!me || !isUuid(postId)) return null;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id, status, caption, moderation_locked, hidden_reason, author_type, author_user_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.author_type !== "user" || post.author_user_id !== me) return null;
  const parts = await readLookParts(supabase, postId, true);
  return {
    id: post.id,
    status: post.status,
    caption: post.caption,
    moderationLocked: post.moderation_locked,
    hiddenReason: post.hidden_reason,
    ...parts,
    styleIds: parts.tags.filter((t) => t.type === "style").map((t) => t.id),
    occasionIds: parts.tags.filter((t) => t.type === "occasion").map((t) => t.id),
  };
}

/** Borradores propios, más recientes primero. */
export async function getMyDrafts(): Promise<{ id: string; image: string | null; updatedAt: string; caption: string | null }[]> {
  const session = await getCurrentUser();
  const me = session?.profile?.id;
  if (!me) return [];
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, caption, updated_at")
    .eq("author_user_id", me)
    .eq("author_type", "user")
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(20);
  const ids = (posts ?? []).map((p) => p.id);
  const { data: imgs } = ids.length
    ? await supabase.from("post_images").select("post_id, cf_image_id, position").in("post_id", ids).order("position")
    : { data: [] as { post_id: string; cf_image_id: string; position: number }[] };
  const first = new Map<string, string>();
  for (const i of imgs ?? []) if (!first.has(i.post_id)) first.set(i.post_id, i.cf_image_id);
  return (posts ?? []).map((p) => ({ id: p.id, image: first.get(p.id) ?? null, updatedAt: p.updated_at, caption: p.caption }));
}

// ── ficha pública ─────────────────────────────────────────────────────────────────────────

/** Datos públicos de un look para la ficha (cualquier autor). null si no es visible. */
export const getLookDetail = cache(async (postId: string): Promise<LookDetail | null> => {
  if (!isUuid(postId)) return null;
  const supabase = await createClient();
  const session = await getCurrentUser();
  const me = session?.profile?.id ?? null;
  const { data: post } = await supabase
    .from("posts")
    .select("id, status, caption, author_type, author_user_id, author_brand_id, published_at, moderation_locked, hidden_reason")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return null;
  const isMine = Boolean(me && post.author_user_id === me);
  // Un borrador o un look oculto solo lo ve su autor (la RLS ya lo filtra; esto lo deja explícito).
  if (post.status !== "published" && !isMine) return null;

  const [parts, { count: likeCount }, author] = await Promise.all([
    readLookParts(supabase, postId, isMine),
    supabase.from("post_likes").select("post_id", { count: "exact", head: true }).eq("post_id", postId),
    readAuthor(supabase, post),
  ]);
  if (post.author_type !== "user" && !author) return null; // marca inactiva

  return {
    id: post.id,
    status: post.status,
    caption: post.caption,
    moderationLocked: post.moderation_locked,
    hiddenReason: post.hidden_reason,
    ...parts,
    author,
    authorUserId: post.author_user_id,
    publishedAt: post.published_at,
    likeCount: likeCount ?? 0,
    isMine,
  };
});

async function readAuthor(
  supabase: Supabase,
  post: { author_type: string; author_user_id: string | null; author_brand_id: string | null },
): Promise<LookAuthor | null> {
  if (post.author_type === "user" && post.author_user_id) {
    const profiles = await getPublicProfiles([post.author_user_id]);
    const profile = profiles.get(post.author_user_id);
    return profile ? { kind: "user", profile } : null;
  }
  if (!post.author_brand_id) return null;
  const { data: b } = await supabase
    .from("brands")
    .select("id, name, slug, logo_url, is_verified, city_id")
    .eq("id", post.author_brand_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!b) return null;
  const { data: city } = b.city_id
    ? await supabase.from("cities").select("name").eq("id", b.city_id).maybeSingle()
    : { data: null };
  return { kind: "brand", id: b.id, name: b.name, slug: b.slug, logo: b.logo_url, verified: b.is_verified, city: city?.name ?? null };
}
