import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
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
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <SiteHeader />

        <div className="mt-8 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-medium tracking-tight text-forest">
            Carga masiva de prendas
          </h1>
          <Link href="/admin" className="text-sm font-medium text-coral hover:underline">
            ← Panel
          </Link>
        </div>

        {/* Paso 1: plantilla + importar */}
        <GlassCard className="mt-6 p-6">
          <h2 className="text-lg font-medium text-forest">1 · Llena y sube la plantilla</h2>
          <p className="mt-1 text-sm text-ink/60">
            Descarga la plantilla, complétala (columnas: marca, titulo, precio_cop,
            url_producto, color, tela, categoria, tallas) y súbela. Las prendas se crean
            en estado <b>pendiente</b> sin foto.
          </p>
          <a
            href="/admin/bulk/template"
            className="mt-4 inline-block rounded-full bg-white/60 px-4 py-2 text-sm font-medium text-forest hover:bg-white"
          >
            ↓ Descargar plantilla Excel
          </a>
          <div className="mt-5 border-t border-ink/10 pt-5">
            <ImportForm />
          </div>
        </GlassCard>

        {/* Paso 2: montar fotos */}
        <GlassCard className="mt-6 mb-12 p-6">
          <h2 className="text-lg font-medium text-forest">
            2 · Súbeles la foto ({items.length} por completar)
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Selecciona la foto de cada prenda y pulsa <b>Subir todas</b> (o elimínalas si
            las importaste por error). Al subir la foto, la prenda pasa a <b>publicada</b>{" "}
            y aparece en el feed.
          </p>

          <PendingGarments items={items} />
        </GlassCard>
      </div>
    </>
  );
}
