import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";

// Vista 404 compartida: la usan los not-found.tsx de cada ruta con su propio texto.
export function NotFoundView({ title, message }: { title: string; message: string }) {
  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <SiteHeader />
        <GlassCard className="mx-auto mt-16 max-w-md p-8 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-ink/50">404</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-3 text-ink/70">{message}</p>
          <Link
            href="/feed"
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-forest px-6 font-medium text-white hover:bg-forest-deep"
          >
            Volver al feed
          </Link>
        </GlassCard>
      </div>
    </>
  );
}
