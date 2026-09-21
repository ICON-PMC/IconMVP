import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { PageShell, SectionHeader } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";
import { formatCop } from "@/lib/taxonomy";
import { ImportForm } from "./import-form";
import { PendingGarments, type PendingItem } from "./pending-garments";

export default async function BulkPage() {
  await requireStaff();
  const supabase = await createClient();

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

        {/* Paso 1: plantilla + importar */}
        <GlassCard className="mt-6 p-5">
          <SectionHeader
            title="Paso 1 de 2 · Sube la plantilla"
            description="Completa las columnas marca, titulo, precio_cop, url_producto, color, tela, categoria y tallas. Las prendas se crean como pendientes, sin foto."
          />
          <div className="mt-4">
            <ImportForm />
          </div>
        </GlassCard>

        {/* Paso 2: montar fotos */}
        <GlassCard className="mt-6 p-5">
          <SectionHeader
            title={`Paso 2 de 2 · Agrega las fotos (${items.length})`}
            description="Elige la foto de cada prenda y pulsa Subir. Al subirla, la prenda pasa a publicada y aparece en el feed. Selecciona las que importaste por error para eliminarlas."
          />
          <div className="mt-4">
            <PendingGarments items={items} />
          </div>
        </GlassCard>
      </PageShell>
    </>
  );
}
