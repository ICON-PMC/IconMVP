import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { PageShell, SectionHeader } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";
import { formatCop } from "@/lib/taxonomy";
import { ImportPackageForm } from "./import-package-form";
import { PendingGarments, type PendingItem } from "./pending-garments";
import { CatalogPanel, type ResumableRun } from "./catalog/catalog-panel";
import { RunsList, type RunListItem } from "./catalog/runs-list";
import { purgeExpiredRuns, type CatalogComparison } from "@/lib/catalog-runs";

// Las tandas de lectura de catálogo (server actions de esta página) pueden tardar hasta ~40 s.
export const maxDuration = 60;

const PHASE_LABEL: Record<string, string> = {
  reading: "Leyendo el catálogo de la tienda",
  photos: "Descargando fotos",
  building: "Armando el Excel",
};

export default async function BulkPage() {
  await requireStaff();
  const supabase = await createClient();

  // Limpieza oportunista de corridas vencidas (7 días); si falla no debe impedir ver la página.
  await purgeExpiredRuns(supabase).catch((e) => console.error("[bulk] purga falló:", e));

  // Prendas pendientes (creadas por carga masiva) que aún no tienen foto.
  const { data: pendingGarments } = await supabase
    .from("garments")
    .select("id, title, price_cop, brand_id")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(300);

  const ids = (pendingGarments ?? []).map((g) => g.id);
  const { data: imgs } = ids.length
    ? await supabase.from("garment_images").select("garment_id").in("garment_id", ids)
    : { data: [] };
  const withImg = new Set((imgs ?? []).map((i) => i.garment_id));
  const needPhoto = (pendingGarments ?? []).filter((g) => !withImg.has(g.id));

  const brandIds = [...new Set(needPhoto.map((g) => g.brand_id))];
  const { data: brandRows } = brandIds.length
    ? await supabase.from("brands").select("id, name").in("id", brandIds)
    : { data: [] };
  const brandName = new Map((brandRows ?? []).map((b) => [b.id, b.name]));

  // Marcas activas (destino de la lectura de catálogo) y corridas sin terminar que se pueden retomar.
  const [{ data: activeBrands }, { data: runRows }] = await Promise.all([
    supabase.from("brands").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("catalog_runs")
      .select("id, brand_id, source_label, phase")
      .in("phase", ["reading", "photos", "building"])
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const activeBrandName = new Map((activeBrands ?? []).map((b) => [b.id, b.name]));

  // Historial de corridas (sin el arreglo de productos, que es pesado) con los nombres del equipo.
  const { data: history } = await supabase
    .from("catalog_runs")
    .select(
      "id, brand_id, created_by, source_kind, source_label, consent_confirmed, phase, stats, is_complete, error, expires_at, created_at, imported_at, imported_by, import_stats, actions, comparison",
    )
    .order("created_at", { ascending: false })
    .limit(30);
  const { data: team } = history?.length ? await supabase.rpc("admin_list_users", { q: null }) : { data: [] };
  const personName = new Map((team ?? []).map((u) => [u.id, u.display_name || u.email || "Equipo"]));
  const historyBrandIds = [...new Set((history ?? []).map((r) => r.brand_id))];
  const { data: historyBrands } = historyBrandIds.length
    ? await supabase.from("brands").select("id, name").in("id", historyBrandIds)
    : { data: [] };
  const historyBrandName = new Map((historyBrands ?? []).map((b) => [b.id, b.name]));
  const runs: RunListItem[] = (history ?? []).map((r) => {
    const cmp = (r.comparison ?? null) as CatalogComparison | null;
    const expired = new Date(r.expires_at) < new Date();
    return {
      id: r.id,
      brandName: historyBrandName.get(r.brand_id) ?? "Marca eliminada",
      sourceKind: r.source_kind,
      sourceLabel: r.source_label,
      consentConfirmed: r.consent_confirmed,
      phase: r.phase,
      createdAt: r.created_at,
      expired,
      createdByName: (r.created_by && personName.get(r.created_by)) || "Equipo",
      isComplete: r.is_complete,
      error: r.error,
      stats: (r.stats ?? null) as RunListItem["stats"],
      importedAt: r.imported_at,
      importedByName: (r.imported_by && personName.get(r.imported_by)) || null,
      importStats: (r.import_stats ?? null) as RunListItem["importStats"],
      actions: (Array.isArray(r.actions) ? (r.actions as { type: "archive" | "republish"; at: string; garment_ids?: string[] }[]) : []).map(
        (a) => ({ type: a.type, at: a.at, count: a.garment_ids?.length ?? 0 }),
      ),
      // El panel solo aparece mientras haya algo por resolver y la corrida siga vigente.
      comparison:
        cmp && r.phase === "done" && !expired && (cmp.ya_no.length > 0 || cmp.reaparecen.length > 0) ? cmp : null,
    };
  });
  const resumable: ResumableRun[] = (runRows ?? []).map((r) => ({
    id: r.id,
    brandName: activeBrandName.get(r.brand_id) ?? brandName.get(r.brand_id) ?? "una marca",
    sourceLabel: r.source_label,
    label: PHASE_LABEL[r.phase] ?? "En curso",
  }));

  const items: PendingItem[] = needPhoto.map((g) => ({
    id: g.id,
    title: g.title,
    subtitle:
      (brandName.get(g.brand_id) ?? "—") +
      (g.price_cop != null ? ` · ${formatCop(g.price_cop)}` : ""),
  }));

  return (
    <>
      <Aurora />
      <PageShell width="4xl">
        <SiteHeader />
        <Link
          href="/admin"
          className="mt-6 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-ink/70 hover:text-forest"
        >
          <ChevronLeftIcon className="size-4" /> Panel
        </Link>
        <h1 className="text-2xl font-medium tracking-tight text-forest sm:text-3xl">
          Carga masiva de prendas
        </h1>

        {/* Leer el catálogo de una tienda → paquete (Excel + fotos) */}
        <GlassCard className="mt-6 p-5">
          <SectionHeader
            title="Leer el catálogo de una tienda"
            description="Opcional. Genera el Excel y las fotos de una marca desde su tienda Shopify o su CSV, para revisarlos y subirlos abajo. Esto no crea prendas en Icon."
          />
          <div className="mt-4">
            <CatalogPanel
              brands={activeBrands ?? []}
              hasDefaultContact={!!process.env.CATALOG_BOT_CONTACT?.trim()}
              resumable={resumable}
            />
          </div>
        </GlassCard>

        {/* Paso 1: plantilla + importar */}
        <GlassCard className="mt-6 p-5">
          <SectionHeader
            title="Paso 1 de 2 · Sube el Excel y la carpeta de fotos"
            description="Elige el Excel (la plantilla completada o el catalogo.xlsx del paquete ya revisado) y la carpeta de fotos, y súbelos de una sola vez. Las fotos se emparejan con las prendas por la columna «foto». Una prenda con foto se publica sola; sin foto queda pendiente. Si una prenda ya existe (misma marca y enlace de compra), no se duplica."
          />
          <div className="mt-4">
            <ImportPackageForm />
          </div>
        </GlassCard>

        {/* Paso 2: montar fotos */}
        <GlassCard className="mt-6 p-5">
          <SectionHeader
            title={`Paso 2 de 2 · Prendas sin foto (${items.length})`}
            description="Las prendas que quedaron sin foto (por ejemplo, porque su archivo no estaba en la carpeta). Elige la foto de cada una y pulsa Subir: al subirla, la prenda pasa a publicada y aparece en el feed. Selecciona las que importaste por error para eliminarlas."
          />
          <div className="mt-4">
            <PendingGarments items={items} />
          </div>
        </GlassCard>

        {/* Historial de lecturas de catálogo (procedencia y consentimiento) */}
        <GlassCard className="mt-6 p-5">
          <SectionHeader
            title="Historial de lecturas de catálogo"
            description="Quién leyó el catálogo de qué marca, de dónde y cuándo, con la confirmación de consentimiento. Los paquetes se conservan 7 días."
          />
          <div className="mt-4">
            <RunsList runs={runs} />
          </div>
        </GlassCard>
      </PageShell>
    </>
  );
}
