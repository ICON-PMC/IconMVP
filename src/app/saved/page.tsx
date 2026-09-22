import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getMyFollowedBrands, getMyLikedPostIds } from "@/lib/social";
import { SiteHeader } from "@/components/site-header";
import { Aurora } from "@/components/aurora";
import { PostCard } from "@/components/post-card";
import { GarmentCard } from "@/components/garment-card";
import { BrandCard } from "@/components/brand-card";
import { SavedTabs } from "./saved-tabs";

const TABS = new Set(["guardados", "siguiendo"]);

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/saved");

  const { tab: tabParam } = await searchParams;
  const tabRaw = tabParam ? String(tabParam) : "guardados";
  const tab = TABS.has(tabRaw) ? tabRaw : "guardados"; // valor raro → default

  // ===================== Tab "Siguiendo" =====================
  // Early return (mismo criterio que /admin?tab=marcas): así las queries del tab
  // Guardados no corren cuando se está mirando el otro tab.
  if (tab === "siguiendo") {
    const followed = await getMyFollowedBrands();
    return (
      <>
        <Aurora />
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <SiteHeader />

          <h1 className="mt-8 mb-4 text-3xl font-medium tracking-tight text-forest">
            Lo mío
          </h1>
          <SavedTabs active="siguiendo" />

          {followed.length === 0 ? (
            <p className="text-sm text-ink/60">Aún no sigues ninguna marca.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {followed.map((b) => (
                <BrandCard
                  key={b.id}
                  slug={b.slug}
                  name={b.name}
                  bio={b.bio}
                  cityName={b.city_name}
                  isVerified={b.is_verified}
                  isSustainable={b.is_sustainable}
                  garments={b.garments}
                />
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  // ===================== Tab "Guardados" (lo que ya existía) =====================
  const supabase = await createClient();
  const userId = session.profile.id;

  const [{ data: sp }, { data: sg }, likedPostIds] = await Promise.all([
    supabase
      .from("saved_posts")
      .select("post_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_garments")
      .select("garment_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    getMyLikedPostIds(),
  ]);

  const postIds = (sp ?? []).map((r) => r.post_id);
  const garmentIds = (sg ?? []).map((r) => r.garment_id);

  const posts = postIds.length
    ? ((await supabase.from("post_feed").select("*").in("id", postIds)).data ?? [])
    : [];
  const garments = garmentIds.length
    ? ((
        await supabase
          .from("garments")
          .select("id, title, price_cop")
          .in("id", garmentIds)
          .eq("status", "published")
      ).data ?? [])
    : [];
  const gimages = garmentIds.length
    ? ((
        await supabase
          .from("garment_images")
          .select("garment_id, cf_image_id, position")
          .in("garment_id", garmentIds)
          .order("position")
      ).data ?? [])
    : [];
  const imageOf = (gid: string) =>
    gimages.find((x) => x.garment_id === gid)?.cf_image_id ?? null;

  const empty = posts.length === 0 && garments.length === 0;

  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <SiteHeader />

        <h1 className="mt-8 mb-4 text-3xl font-medium tracking-tight text-forest">
          Lo mío
        </h1>
        <SavedTabs active="guardados" />

        {empty && (
          <p className="text-sm text-ink/60">
            Aún no has guardado nada. Toca el marcador en un look o una prenda.
          </p>
        )}

        {posts.length > 0 && (
          <>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-ink/50">
              Looks
            </h2>
            <div className="columns-2 gap-4 md:columns-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} saved liked={likedPostIds.has(p.id)} isLoggedIn={true} path="/saved" />
              ))}
            </div>
          </>
        )}

        {garments.length > 0 && (
          <>
            <h2 className="mt-10 mb-4 text-sm font-medium uppercase tracking-wide text-ink/50">
              Prendas
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {garments.map((g) => (
                <GarmentCard
                  key={g.id}
                  id={g.id}
                  title={g.title}
                  price_cop={g.price_cop}
                  image={imageOf(g.id)}
                  saved
                  path="/saved"
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
