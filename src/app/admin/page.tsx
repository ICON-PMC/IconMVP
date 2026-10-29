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
import { TagsTab, type AdminTag } from "./_components/tags-tab";
import { BrandsTab, type AdminBrand } from "./_components/brands-tab";
import { UsersTab, type AdminUser } from "./_components/users-tab";
import { cityLabel } from "@/lib/cities";
import { getCityOptions } from "@/lib/cities";

const REVIEW_NOTICES: Record<string, string> = {
  aprobada: "✓ Marca aprobada. Verá el resultado al ingresar a su panel; por ahora no enviamos correos.",
  rechazada: "✓ Marca rechazada. Verá la nota al ingresar a su panel; por ahora no enviamos correos.",
};

const FLASH = {
  marca: "Marca creada.",
  prenda: "Prenda creada.",
  post: "Post creado.",
  etiqueta: "Etiqueta creada.",
  renombrada: "Etiqueta renombrada.",
  borrada: "Etiqueta borrada.",
  sinonimos: "Sinónimos guardados.",
  "sinonimos-borrados": "Grupo de sinónimos borrado.",
  ignoradas: "Palabras agregadas.",
  "ignorada-borrada": "Palabra quitada.",
  "marca-eliminada": "Marca eliminada.",
};

// Todas las marcas con su ciudad y cuántas prendas y looks tienen (son pocas: se filtra en el cliente).
async function loadBrands(): Promise<AdminBrand[]> {
  const supabase = await createClient();
  const [{ data: brands }, { data: garments }, { data: posts }] = await Promise.all([
    supabase
      .from("brands")
      .select("id, name, slug, status, is_active, is_verified, is_sustainable, city_id, owner_user_id")
      .order("name"),
    supabase.from("garments").select("brand_id"),
    supabase.from("posts").select("author_brand_id").not("author_brand_id", "is", null),
  ]);
  const cityIds = [...new Set((brands ?? []).flatMap((b) => (b.city_id ? [b.city_id] : [])))];
  const { data: cities } = cityIds.length
    ? await supabase.from("cities").select("id, name, department").in("id", cityIds)
    : { data: [] };
  const cityOf = new Map((cities ?? []).map((c) => [c.id, cityLabel(c.name, c.department)]));
  const count = (rows: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const id of rows) if (id) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  };
  const gCount = count((garments ?? []).map((g) => g.brand_id));
  const pCount = count((posts ?? []).map((p) => p.author_brand_id));
  return (brands ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    status: b.status,
    is_active: b.is_active,
    is_verified: b.is_verified,
    is_sustainable: b.is_sustainable,
    city: b.city_id ? (cityOf.get(b.city_id) ?? null) : null,
    garments: gCount.get(b.id) ?? 0,
    looks: pCount.get(b.id) ?? 0,
    hasOwner: !!b.owner_user_id,
  }));
}

async function loadUsers(q: string | undefined): Promise<AdminUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", { q: q ?? null });
  if (error) console.error("[admin] admin_list_users falló:", error.message);
  return data ?? [];
}

async function loadSearchVocabulary() {
  const supabase = await createClient();
  const [synonyms, stopwords] = await Promise.all([
    supabase.from("search_synonyms").select("id, terms").order("created_at"),
    supabase.from("search_stopwords").select("word").order("word"),
  ]);
  return { synonyms: synonyms.data ?? [], stopwords: (stopwords.data ?? []).map((s) => s.word) };
}

// Vocabulario con cuántas veces se usa cada etiqueta (prendas, posts, marcas, preferencias).
async function loadTags(): Promise<AdminTag[]> {
  const supabase = await createClient();
  const [tags, usage] = await Promise.all([
    supabase.from("tags").select("id, name, slug, type").order("name"),
    supabase.rpc("tag_usage_counts"),
  ]);
  const count = new Map((usage.data ?? []).map((u) => [u.tag_id, u.uses]));
  return (tags.data ?? []).map((t) => ({ ...t, uses: count.get(t.id) ?? 0 }));
}

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
      getCityOptions(supabase),
      tags("category"),
      tags("occasion"),
      tags("style"),
      tags("temperature"),
      supabase.from("sizes").select("id, label").order("sort_order"),
      supabase.from("brands").select("id, name").order("name"),
      supabase.from("garments").select("id, title").order("created_at", { ascending: false }),
    ]);
  return {
    cities,
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
  searchParams: Promise<{ tab?: string; form?: string; aviso?: string; q?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login?next=/admin");
  if (!isStaff(session.profile)) redirect("/");
  const { tab: tabParam, form, aviso, q } = await searchParams;
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
          {tab === "marcas" && <BrandsTab brands={await loadBrands()} />}
          {tab === "usuarios" && (
            <UsersTab
              users={await loadUsers(q)}
              q={q ?? ""}
              canEdit={session.profile?.role === "admin"}
              myId={session.profile?.id ?? ""}
            />
          )}
          {tab === "pendientes" && (
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
          {tab === "etiquetas" && <TagsTab tags={await loadTags()} {...await loadSearchVocabulary()} />}
        </div>
      </PageShell>
    </>
  );
}
