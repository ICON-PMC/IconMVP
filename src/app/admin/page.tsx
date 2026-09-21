import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { FlashToast } from "@/components/flash-toast";
import { PageShell, SectionHeader } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { AdminTabs, parseAdminTab } from "./admin-tabs";
import { PendingBrands, pendingBrandsCount } from "./pending-brands";
import { MetricsTab } from "./_components/metrics-tab";
import { UploadTab, parseUploadForm, type UploadData } from "./_components/upload-tab";

const REVIEW_NOTICES: Record<string, string> = {
  aprobada: "✓ Marca aprobada. Verá el resultado al ingresar a su panel; por ahora no enviamos correos.",
  rechazada: "✓ Marca rechazada. Verá la nota al ingresar a su panel; por ahora no enviamos correos.",
};

const FLASH = {
  marca: "Marca creada.",
  prenda: "Prenda creada.",
  post: "Post creado.",
};

// Fuera del componente: react-hooks/purity prohíbe llamar Date.now() durante el render.
function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 864e5).toISOString();
}

async function loadMetrics() {
  const supabase = await createClient();
  const sevenDaysAgo = daysAgoIso(7);
  // Solo staff puede leer outbound_clicks.
  const [brands, garments, posts, clicksTotal, clicks7d, topBrandsRes, topGarmentsRes] =
    await Promise.all([
      supabase.from("brands").select("*", { count: "exact", head: true }),
      supabase.from("garments").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase.from("outbound_clicks").select("*", { count: "exact", head: true }),
      supabase
        .from("outbound_clicks")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
      supabase.from("brand_click_counts").select("*").order("clicks", { ascending: false }).limit(6),
      supabase.from("garment_click_counts").select("*").order("clicks", { ascending: false }).limit(6),
    ]);
  return {
    totals: { brands: brands.count ?? 0, garments: garments.count ?? 0, posts: posts.count ?? 0 },
    clicks: { total: clicksTotal.count ?? 0, last7d: clicks7d.count ?? 0 },
    topBrands: (topBrandsRes.data ?? [])
      .filter((b) => b.clicks > 0)
      .map((b) => ({ id: b.brand_id, name: b.brand_name, clicks: b.clicks })),
    topGarments: (topGarmentsRes.data ?? [])
      .filter((g) => g.clicks > 0)
      .map((g) => ({ id: g.garment_id, name: g.title, clicks: g.clicks })),
  };
}

async function loadUploadData(): Promise<UploadData> {
  const supabase = await createClient();
  const tags = (type: "category" | "occasion" | "style" | "temperature") =>
    supabase.from("tags").select("id, name").eq("type", type).order("name");
  const [cities, categories, occasions, styles, temperatures, sizes, brands, garments] =
    await Promise.all([
      supabase.from("cities").select("id, name").order("name"),
      tags("category"),
      tags("occasion"),
      tags("style"),
      tags("temperature"),
      supabase.from("sizes").select("id, label").order("sort_order"),
      supabase.from("brands").select("id, name").order("name"),
      supabase.from("garments").select("id, title").order("created_at", { ascending: false }),
    ]);
  return {
    cities: cities.data ?? [],
    categories: categories.data ?? [],
    occasions: occasions.data ?? [],
    styles: styles.data ?? [],
    temperatures: temperatures.data ?? [],
    sizes: sizes.data ?? [],
    brands: brands.data ?? [],
    garments: garments.data ?? [],
  };
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; form?: string; aviso?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login?next=/admin");
  if (!isStaff(session.profile)) redirect("/");
  const { tab: tabParam, form, aviso } = await searchParams;
  const tab = parseAdminTab(tabParam);
  const pendingCount = await pendingBrandsCount();

  return (
    <>
      <Aurora />
      <PageShell>
        <SiteHeader />
        <Suspense>
          <FlashToast messages={FLASH} />
        </Suspense>

        <SectionHeader
          as="h1"
          title="Panel del equipo"
          description={`${session.profile?.display_name ?? session.email} · ${session.profile?.role}`}
          className="mt-8"
          action={
            <Button
              nativeButton={false}
              render={<Link href="/admin/bulk" />}
              variant="outline"
              className="rounded-full"
            >
              Carga masiva
            </Button>
          }
        />

        <AdminTabs active={tab} pendingCount={pendingCount} />

        <div className="mt-6">
          {tab === "metricas" && <MetricsTab {...(await loadMetrics())} />}
          {tab === "cargar" && (
            <UploadTab form={parseUploadForm(form)} data={await loadUploadData()} />
          )}
          {tab === "marcas" && (
            <>
              {aviso && REVIEW_NOTICES[aviso] && (
                <p
                  role="status"
                  className="rounded-xl bg-leaf-soft px-3 py-2 text-sm text-forest-deep"
                >
                  {REVIEW_NOTICES[aviso]}
                </p>
              )}
              <PendingBrands />
            </>
          )}
        </div>
      </PageShell>
    </>
  );
}
