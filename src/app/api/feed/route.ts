import { NextRequest, NextResponse } from "next/server";
import { parseFeedParams, getFeedPage, FEED_PAGE_SIZE } from "@/lib/feed";
import { getMySavedIds } from "@/lib/saves";
import { getMyLikedGarmentIds, getMyLikedPostIds } from "@/lib/social";
import { getFollowingFeedPage, getProfileTab, parseProfileTab } from "@/lib/profile";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/look-rules";

// Fuente de la tanda: feed normal, pestaña de un perfil (spec 009) o vista "Siguiendo" (spec 009).
async function loadPage(sp: Record<string, string>, offset: number) {
  if (sp.profile && isUuid(sp.profile)) {
    return { ...(await getProfileTab(sp.profile, parseProfileTab(sp.tab), offset)), error: null };
  }
  if (sp.ver === "siguiendo" && (await getCurrentUser())) {
    return { ...(await getFollowingFeedPage(offset)), error: null };
  }
  const { filters, sort, priceRange } = parseFeedParams(sp);
  const signedIn = Boolean((await getCurrentUser())?.profile);
  return getFeedPage(filters, sort, offset, FEED_PAGE_SIZE, { price: priceRange, asOf: sp.as_of ?? null, signedIn });
}

// Siguiente lote del feed mixto para el scroll infinito de <FeedGrid>.
// Recibe los mismos parámetros que /feed (filtros + sort) más `offset`.
export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const raw = Number(sp.offset ?? 0);
  const offset = Number.isFinite(raw) && raw >= 0 ? raw : 0;

  const [{ items, nextOffset, error }, saved, liked, likedGarments] =
    await Promise.all([
      loadPage(sp, offset),
      getMySavedIds(),
      getMyLikedPostIds(),
      getMyLikedGarmentIds(),
    ]);

  if (error) {
    return NextResponse.json(
      { error: "No pudimos cargar más contenido. Intenta de nuevo." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      items,
      nextOffset,
      savedPosts: [...saved.posts],
      savedGarments: [...saved.garments],
      likedPosts: [...liked],
      likedGarments: [...likedGarments],
    },
    // Datos de la persona (guardados, likes): nunca en caché compartida (spec 006, FR-018).
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
