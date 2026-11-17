import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { FEED_PAGE_SIZE, type FeedItem } from "@/lib/feed";

// Perfil público (spec 009). Todo lo que el público ve de una cuenta pasa por funciones de la base
// que deciden la visibilidad (get_public_profile, profile_liked): privado, oculto e inexistente
// responden igual.

export type Profile = {
  id: string;
  handle: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  linkUrl: string | null;
  cityName: string | null;
  isPublic: boolean;
  likesVisible: boolean;
  /** Preferencia del dueño (solo útil para él: likesVisible ya combina público + oculto). */
  showLikes: boolean;
  isHidden: boolean;
  hiddenReason: string | null;
  isMe: boolean;
  iFollow: boolean;
  counts: { looks: number; followers: number; following: number };
};

export type ProfileResult = { kind: "profile"; profile: Profile } | { kind: "brand"; slug: string } | { kind: "unavailable" };

type RawProfile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_key: string | null;
  bio: string | null;
  link_url: string | null;
  city_name: string | null;
  is_public: boolean;
  likes_visible: boolean;
  show_likes: boolean;
  is_hidden: boolean;
  hidden_reason: string | null;
  is_me: boolean;
  i_follow: boolean;
  counts: { looks: number; followers: number; following: number };
  redirect_brand_slug?: string;
};

/** Compartido entre la página y generateMetadata en la misma petición. */
export const getProfile = cache(async (handle: string): Promise<ProfileResult> => {
  const clean = decodeURIComponent(handle).trim().toLowerCase();
  if (!/^[a-z0-9._]{3,24}$/.test(clean)) return { kind: "unavailable" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_profile", { p_handle: clean });
  if (error) {
    console.error("[profile] get_public_profile falló:", error.message);
    return { kind: "unavailable" };
  }
  const p = data as RawProfile | null;
  if (!p) return { kind: "unavailable" };
  if (p.redirect_brand_slug) return { kind: "brand", slug: p.redirect_brand_slug };
  return {
    kind: "profile",
    profile: {
      id: p.id,
      handle: p.handle,
      displayName: p.display_name,
      avatar: p.avatar_key,
      bio: p.bio,
      linkUrl: p.link_url,
      cityName: p.city_name,
      isPublic: p.is_public,
      likesVisible: p.likes_visible,
      showLikes: p.show_likes,
      isHidden: p.is_hidden,
      hiddenReason: p.hidden_reason,
      isMe: p.is_me,
      iFollow: p.i_follow,
      counts: p.counts,
    },
  };
});

export type ProfileTab = "looks" | "prendas" | "me-gusta";
export const PROFILE_TABS: ProfileTab[] = ["looks", "prendas", "me-gusta"];
export function parseProfileTab(raw: unknown): ProfileTab {
  return PROFILE_TABS.includes(raw as ProfileTab) ? (raw as ProfileTab) : "looks";
}

/** Una tanda de una pestaña del perfil. Las de likes devuelven vacío si la persona no las muestra. */
export async function getProfileTab(
  userId: string,
  tab: ProfileTab,
  offset = 0,
): Promise<{ items: FeedItem[]; nextOffset: number | null }> {
  const supabase = await createClient();
  const limit = FEED_PAGE_SIZE;
  let items: FeedItem[] = [];
  if (tab === "looks") {
    const { data, error } = await supabase
      .from("feed_items")
      .select("*")
      .eq("kind", "post")
      .eq("author_user_id", userId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id")
      .range(offset, offset + limit - 1);
    if (error) console.error("[profile] looks falló:", error.message);
    items = (data ?? []) as FeedItem[];
  } else {
    const { data, error } = await supabase.rpc("profile_liked", {
      p_user_id: userId,
      p_kind: tab === "prendas" ? "garment" : "post",
      p_limit: limit,
      p_offset: offset,
    });
    if (error) console.error("[profile] profile_liked falló:", error.message);
    items = (data ?? []) as FeedItem[];
  }
  return { items, nextOffset: items.length === limit ? offset + limit : null };
}

export type FollowingRow = { kind: "brand" | "user"; id: string; name: string; slugOrHandle: string; image: string | null };

function mapRows(rows: { kind: "brand" | "user"; id: string; name: string; slug_or_handle: string; image: string | null }[] | null): FollowingRow[] {
  return (rows ?? []).map((r) => ({ kind: r.kind, id: r.id, name: r.name, slugOrHandle: r.slug_or_handle, image: r.image }));
}

/** Marcas y personas que sigue la persona con sesión (privado). */
export async function getMyFollowing(): Promise<FollowingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_following");
  return mapRows(data);
}

export async function getFollowSuggestions(): Promise<FollowingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("follow_suggestions");
  return mapRows(data);
}

/** Tanda de la vista "Siguiendo" (solo con sesión). */
export async function getFollowingFeedPage(offset = 0): Promise<{ items: FeedItem[]; nextOffset: number | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_following_feed", { p_limit: FEED_PAGE_SIZE, p_offset: offset });
  if (error) console.error("[profile] get_following_feed falló:", error.message);
  const items = (data ?? []) as FeedItem[];
  return { items, nextOffset: items.length === FEED_PAGE_SIZE ? offset + FEED_PAGE_SIZE : null };
}

export function profileHref(handle: string) {
  return `/u/${handle}`;
}

/** Si la persona con sesión sigue a `userId` (para el botón de la ficha de un look). */
export async function doIFollow(myId: string | null | undefined, userId: string): Promise<boolean> {
  if (!myId || myId === userId) return false;
  const supabase = await createClient();
  const { count } = await supabase
    .from("user_follows")
    .select("followed_id", { count: "exact", head: true })
    .eq("follower_id", myId)
    .eq("followed_id", userId);
  return (count ?? 0) > 0;
}
