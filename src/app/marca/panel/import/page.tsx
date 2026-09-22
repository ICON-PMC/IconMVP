import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";
import { requireBrandOwner } from "@/lib/auth";
import { listInstagramMedia } from "../actions";
import { ImportPicker } from "./import-picker";

export default async function InstagramImportPage() {
  await requireBrandOwner();
  const result = await listInstagramMedia();

  return (
    <>
      <Aurora />
      <PageShell>
        <SiteHeader />
        <Link
          href="/marca/panel?tab=looks"
          className="mt-6 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-ink/70 hover:text-forest"
        >
          <ChevronLeftIcon className="size-4" /> Looks
        </Link>
        <h1 className="text-2xl font-medium tracking-tight text-forest">Importar desde Instagram</h1>
        <p className="mt-1 text-sm text-ink/60">
          Elige las fotos que quieres traer como looks. Entran como borrador; luego taggeas las
          prendas de cada una antes de publicarla.
        </p>

        <GlassCard className="mt-6 p-4 sm:p-6">
          {!result.ok ? (
            <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
              {result.error}
            </p>
          ) : result.items.length === 0 ? (
            <EmptyState
              title="No encontramos fotos"
              description="Tu cuenta no tiene fotos disponibles (o son todas videos/reels)."
            />
          ) : (
            <ImportPicker items={result.items} />
          )}
        </GlassCard>
      </PageShell>
    </>
  );
}
