import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireBrandOwner } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { PageShell, SectionHeader } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";
import { BrandStatusBanner } from "@/components/brand-status-banner";
import { PanelTabs, parseTab } from "./_components/panel-tabs";
import { FlashToast } from "@/components/flash-toast";
import { OverviewTab } from "./_components/overview-tab";
import { CatalogTab } from "./_components/catalog-tab";
import { LooksTab } from "./_components/looks-tab";
import { ProfileTab } from "./_components/profile-tab";

const FLASH = { perfil: "Perfil guardado.", prenda: "Prenda agregada." };

export default async function BrandPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; tab?: string }>;
}) {
  const { brand } = await requireBrandOwner();
  const { error, tab: tabParam } = await searchParams;
  const tab = parseTab(tabParam);

  if (!brand) {
    return (
      <>
        <Aurora />
        <PageShell width="2xl">
          <SiteHeader />
          <GlassCard className="mt-10 p-8 text-center">
            <h1 className="text-2xl font-medium tracking-tight text-forest">
              Conecta tu marca
            </h1>
            <p className="mt-2 text-sm text-ink/60">
              Inicia sesión con tu cuenta de Instagram profesional (Business o Creator)
              para traer tus fotos a Icon.
            </p>
            {error && (
              <p className="mt-4 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
                {error}
              </p>
            )}
            <a
              href="/api/instagram/authorize"
              className="mt-6 inline-block rounded-full bg-forest px-6 py-2.5 text-sm font-medium text-white hover:bg-forest-deep"
            >
              Conectar con Instagram
            </a>
          </GlassCard>
        </PageShell>
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: connection }, { data: garments }, { data: posts }] = await Promise.all([
    supabase
      .from("brand_instagram_connections")
      .select("username, account_type, connected_at")
      .eq("brand_id", brand.id)
      .maybeSingle(),
    supabase
      .from("garments")
      .select("id, title, price_cop, status")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("posts")
      .select("id, caption, status")
      .eq("author_brand_id", brand.id)
      .order("created_at", { ascending: false }),
  ]);

  const gIds = (garments ?? []).map((g) => g.id);
  const gImages = gIds.length
    ? ((
        await supabase
          .from("garment_images")
          .select("garment_id, cf_image_id")
          .in("garment_id", gIds)
          .eq("position", 0)
      ).data ?? [])
    : [];
  const gImageMap = new Map(gImages.map((i) => [i.garment_id, i.cf_image_id]));

  const pIds = (posts ?? []).map((p) => p.id);
  const [pImagesRes, pItemsRes] = pIds.length
    ? await Promise.all([
        supabase
          .from("post_images")
          .select("post_id, cf_image_id")
          .in("post_id", pIds)
          .eq("position", 0),
        supabase.from("post_items").select("post_id").in("post_id", pIds),
      ])
    : [{ data: [] }, { data: [] }];
  const pImageMap = new Map((pImagesRes.data ?? []).map((i) => [i.post_id, i.cf_image_id]));
  const itemCounts = new Map<string, number>();
  for (const it of pItemsRes.data ?? []) {
    itemCounts.set(it.post_id, (itemCounts.get(it.post_id) ?? 0) + 1);
  }

  const catalog = (garments ?? []).map((g) => ({ ...g, cf_image_id: gImageMap.get(g.id) ?? null }));
  const looks = (posts ?? []).map((p) => ({
    ...p,
    cf_image_id: pImageMap.get(p.id) ?? null,
    items: itemCounts.get(p.id) ?? 0,
  }));

  // Solo el catálogo necesita categorías y tallas.
  const [{ data: categories }, { data: sizes }] =
    tab === "catalogo"
      ? await Promise.all([
          supabase.from("tags").select("id, name").eq("type", "category").order("name"),
          supabase.from("sizes").select("id, label").order("sort_order"),
        ])
      : [{ data: [] }, { data: [] }];

  return (
    <>
      <Aurora />
      <PageShell>
        <SiteHeader />
        <Suspense>
          <FlashToast messages={FLASH} />
        </Suspense>

        <SectionHeader as="h1" title="Mi marca" description={brand.name} className="mt-8" />

        <div className="mt-4">
          <BrandStatusBanner brand={brand} />
        </div>

        <PanelTabs active={tab} counts={{ catalogo: catalog.length, looks: looks.length }} />

        <div className="mt-6">
          {tab === "resumen" && (
            <OverviewTab
              connection={connection}
              counts={{
                garments: catalog.length,
                looks: looks.length,
                drafts: looks.filter((l) => l.status === "draft").length,
              }}
            />
          )}
          {tab === "catalogo" && (
            <CatalogTab
              garments={catalog}
              categories={categories ?? []}
              sizes={sizes ?? []}
              canPublish={brand.status === "active"}
            />
          )}
          {tab === "looks" && <LooksTab looks={looks} canImport={!!connection} />}
          {tab === "perfil" && <ProfileTab brand={brand} />}
        </div>
      </PageShell>
    </>
  );
}
