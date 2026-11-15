import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FeedCard } from "@/components/feed-card";
import { getMySavedIds } from "@/lib/saves";
import { getMyLikedGarmentIds } from "@/lib/social";
import { SIMILAR_MIN } from "@/lib/visual/thresholds";

/**
 * "Más como esta" en la ficha de una prenda (spec 005, US4): hasta 8 prendas visualmente
 * parecidas de otras marcas (máx. 2 por marca, sobre el umbral). Si no hay, no se muestra nada.
 */
export async function SimilarGarments({ garmentId, isLoggedIn }: { garmentId: string; isLoggedIn: boolean }) {
  const supabase = await createClient();
  const { data: hits } = await supabase.rpc("similar_garments", {
    p_garment_id: garmentId,
    p_limit: 8,
    p_min: SIMILAR_MIN,
  });
  if (!hits?.length) return null;

  const ids = hits.map((h) => h.id);
  const [{ data: rows }, { data: tags }, saved, liked] = await Promise.all([
    supabase.from("feed_items").select("*").eq("kind", "garment").in("id", ids),
    supabase.from("tags").select("slug, name").in("type", ["occasion", "style"]),
    getMySavedIds(),
    getMyLikedGarmentIds(),
  ]);
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const items = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  if (!items.length) return null;
  const tagNames = Object.fromEntries((tags ?? []).map((t) => [t.slug, t.name]));

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-medium tracking-tight text-forest">Más como esta</h2>
        <Link href={`/feed?similar=${garmentId}`} className="text-sm font-medium text-coral hover:underline">
          Ver más
        </Link>
      </div>
      <div className="columns-2 gap-4 md:columns-4">
        {items.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            tagNames={tagNames}
            saved={saved.garments.has(item.id)}
            liked={liked.has(item.id)}
            isLoggedIn={isLoggedIn}
            path={`/prenda/${garmentId}`}
            from="similar"
          />
        ))}
      </div>
    </section>
  );
}
