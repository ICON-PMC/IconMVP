import { NextRequest, NextResponse } from "next/server";
import type { FeedItem } from "@/lib/feed";
import { getMySavedIds } from "@/lib/saves";
import { getMyLikedGarmentIds, getMyLikedPostIds } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
const MAX = 48;

// Filas completas del feed para una lista de ids ya ordenada (tandas de la búsqueda, spec 006).
// Devuelve solo lo publicado (RLS y la vista) en el mismo orden pedido, más los guardados y likes
// de quien consulta. Nunca se guarda en caché.
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter((x) => UUID.test(x)).slice(0, MAX);
  if (!ids.length) return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "private, no-store" } });

  const supabase = await createClient();
  const [{ data, error }, saved, likedPosts, likedGarments] = await Promise.all([
    supabase.from("feed_items").select("*").in("id", ids),
    getMySavedIds(),
    getMyLikedPostIds(),
    getMyLikedGarmentIds(),
  ]);
  if (error)
    return NextResponse.json({ error: "No pudimos cargar más contenido. Intenta de nuevo." }, { status: 500 });

  const order = new Map(ids.map((id, i) => [id, i]));
  const items = ((data ?? []) as FeedItem[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return NextResponse.json(
    {
      items,
      savedPosts: [...saved.posts],
      savedGarments: [...saved.garments],
      likedPosts: [...likedPosts],
      likedGarments: [...likedGarments],
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
