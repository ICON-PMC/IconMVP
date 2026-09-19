import Link from "next/link";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
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
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <SiteHeader />
        <div className="mt-8 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-medium tracking-tight text-forest">
            Importar desde Instagram
          </h1>
          <Link href="/marca/panel" className="text-sm text-ink/60 hover:text-forest">
            ← Volver
          </Link>
        </div>
        <p className="mt-1 text-sm text-ink/60">
          Elige las fotos que quieres traer como looks. Entran como borrador — luego
          taggeas las prendas de cada una antes de publicarla.
        </p>

        <GlassCard className="mt-6 mb-12 p-6">
          {!result.ok ? (
            <p className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
              {result.error}
            </p>
          ) : result.items.length === 0 ? (
            <p className="text-sm text-ink/50">
              No encontramos fotos en tu cuenta de Instagram (o son todas videos/reels).
            </p>
          ) : (
            <ImportPicker items={result.items} />
          )}
        </GlassCard>
      </div>
    </>
  );
}
