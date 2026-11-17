import { createClient } from "@/lib/supabase/server";
import { getPublicProfiles } from "@/lib/profiles";
import type { CommunityData, ReportGroup } from "@/lib/community-labels";

export * from "@/lib/community-labels";

// Lecturas de las colas del equipo (spec 008, US5). Solo staff: las policies de staff dejan leer
// reportes, marcas mencionadas (incluidas las bloqueadas) y prendas propuestas.

export async function openReportsCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open");
  return count ?? 0;
}

export async function loadOpenReports(): Promise<ReportGroup[]> {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("content_reports")
    .select("target_type, target_id, reason, note, created_at")
    .eq("status", "open")
    .order("created_at");
  const groups = new Map<string, ReportGroup>();
  for (const r of reports ?? []) {
    const k = `${r.target_type}:${r.target_id}`;
    const g =
      groups.get(k) ??
      ({ targetType: r.target_type, targetId: r.target_id, count: 0, reasons: [], notes: [], firstAt: r.created_at, post: null, label: "" } as ReportGroup);
    g.count += 1;
    const reason = g.reasons.find((x) => x.reason === r.reason);
    if (reason) reason.n += 1;
    else g.reasons.push({ reason: r.reason, n: 1 });
    if (r.note) g.notes.push(r.note);
    groups.set(k, g);
  }

  const postIds = [...groups.values()].filter((g) => g.targetType === "post").map((g) => g.targetId);
  const pgIds = [...groups.values()].filter((g) => g.targetType === "proposed_garment").map((g) => g.targetId);
  const profileIds = [...groups.values()].filter((g) => g.targetType === "profile").map((g) => g.targetId);
  const [{ data: posts }, { data: imgs }, { data: pgs }] = await Promise.all([
    postIds.length
      ? supabase.from("posts").select("id, caption, status, hidden_reason, author_user_id, author_brand_id").in("id", postIds)
      : Promise.resolve({ data: [] as { id: string; caption: string | null; status: string; hidden_reason: string | null; author_user_id: string | null; author_brand_id: string | null }[] }),
    postIds.length
      ? supabase.from("post_images").select("post_id, cf_image_id, position").in("post_id", postIds).order("position")
      : Promise.resolve({ data: [] as { post_id: string; cf_image_id: string; position: number }[] }),
    pgIds.length
      ? supabase.from("proposed_garments").select("id, name").in("id", pgIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const profiles = await getPublicProfiles([...(posts ?? []).flatMap((p) => (p.author_user_id ? [p.author_user_id] : [])), ...profileIds]);
  const firstImg = new Map<string, string>();
  for (const i of imgs ?? []) if (!firstImg.has(i.post_id)) firstImg.set(i.post_id, i.cf_image_id);

  for (const g of groups.values()) {
    if (g.targetType === "post") {
      const p = (posts ?? []).find((x) => x.id === g.targetId);
      const author = p?.author_user_id ? profiles.get(p.author_user_id) : null;
      g.post = p
        ? {
            id: p.id,
            image: firstImg.get(p.id) ?? null,
            caption: p.caption,
            status: p.status,
            hiddenReason: p.hidden_reason,
            author: author ? `${author.displayName} (@${author.handle})` : p.author_brand_id ? "Marca" : "Usuario",
            authorUserId: p.author_user_id,
          }
        : null;
      g.label = p ? "Look" : "Look borrado";
    } else if (g.targetType === "proposed_garment") {
      g.label = `Prenda propuesta: ${(pgs ?? []).find((x) => x.id === g.targetId)?.name ?? "borrada"}`;
    } else if (g.targetType === "profile") {
      const pr = profiles.get(g.targetId);
      g.label = pr ? `Perfil: ${pr.displayName} (@${pr.handle})` : "Perfil borrado";
      g.profileHandle = pr?.handle ?? null;
    } else {
      g.label = "Reseña de marca";
    }
  }
  // Más reportados primero; a igual número, el más antiguo.
  return [...groups.values()].sort((a, b) => b.count - a.count || a.firstAt.localeCompare(b.firstAt));
}

export async function loadCommunity(): Promise<CommunityData> {
  const supabase = await createClient();
  const [{ data: stubs }, { data: mentions }, { data: proposed }, { data: blocked }, { data: hidden }] = await Promise.all([
    supabase.from("brand_stubs").select("id, name, status, created_at").neq("status", "claimed").order("created_at", { ascending: false }).limit(200),
    supabase.from("post_brand_mentions").select("brand_stub_id").not("brand_stub_id", "is", null),
    supabase.from("proposed_garments").select("id, name, category_tag_id, brand_id, brand_stub_id, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(200),
    supabase.rpc("admin_blocked_users"),
    supabase.rpc("admin_hidden_profiles"),
  ]);
  const mentionCount = new Map<string, number>();
  for (const m of mentions ?? []) if (m.brand_stub_id) mentionCount.set(m.brand_stub_id, (mentionCount.get(m.brand_stub_id) ?? 0) + 1);

  const pgIds = (proposed ?? []).map((p) => p.id);
  const catIds = [...new Set((proposed ?? []).map((p) => p.category_tag_id))];
  const brandIds = [...new Set((proposed ?? []).flatMap((p) => (p.brand_id ? [p.brand_id] : [])))];
  const [{ data: links }, { data: cats }, { data: brands }] = await Promise.all([
    pgIds.length
      ? supabase.from("post_proposed_items").select("proposed_garment_id, post_id").in("proposed_garment_id", pgIds)
      : Promise.resolve({ data: [] as { proposed_garment_id: string; post_id: string }[] }),
    catIds.length ? supabase.from("tags").select("id, name").in("id", catIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    brandIds.length ? supabase.from("brands").select("id, name").in("id", brandIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const stubName = new Map((stubs ?? []).map((s) => [s.id, s.name]));

  return {
    stubs: (stubs ?? [])
      .map((s) => ({ id: s.id, name: s.name, status: s.status, mentions: mentionCount.get(s.id) ?? 0, createdAt: s.created_at }))
      .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name, "es")),
    proposed: (proposed ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      category: (cats ?? []).find((c) => c.id === p.category_tag_id)?.name ?? "",
      brand: p.brand_id ? ((brands ?? []).find((b) => b.id === p.brand_id)?.name ?? null) : p.brand_stub_id ? (stubName.get(p.brand_stub_id) ?? null) : null,
      postId: (links ?? []).find((l) => l.proposed_garment_id === p.id)?.post_id ?? null,
      createdAt: p.created_at,
    })),
    blocked: (blocked ?? []).map((u) => ({
      id: u.id,
      label: [u.display_name, u.email, `@${u.handle}`].filter(Boolean).join(" · "),
      reason: u.posting_blocked_reason,
      since: u.posting_blocked_at,
    })),
    hiddenProfiles: (hidden ?? []).map((u) => ({
      id: u.id,
      handle: u.handle,
      label: [u.display_name, u.email, `@${u.handle}`].filter(Boolean).join(" · "),
      reason: u.profile_hidden_reason,
      since: u.profile_hidden_at,
    })),
  };
}
