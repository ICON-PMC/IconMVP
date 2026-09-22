import { NextRequest, NextResponse } from "next/server";
import { parseFeedParams, getFeedPage, FEED_PAGE_SIZE } from "@/lib/feed";
import { getMySavedIds } from "@/lib/saves";
import { getMyLikedGarmentIds, getMyLikedPostIds } from "@/lib/social";

// Siguiente lote del feed mixto para el scroll infinito de <FeedGrid>.
// Recibe los mismos parámetros que /feed (filtros + sort) más `offset`.
export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const { filters, sort } = parseFeedParams(sp);
  const offset = Number(sp.offset ?? 0);

  const [{ items, nextOffset, error }, saved, liked, likedGarments] = await Promise.all([
    getFeedPage(filters, sort, Number.isFinite(offset) ? offset : 0, FEED_PAGE_SIZE),
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

  return NextResponse.json({
    items,
    nextOffset,
    savedPosts: [...saved.posts],
    savedGarments: [...saved.garments],
    likedPosts: [...liked],
    likedGarments: [...likedGarments],
  });
}
