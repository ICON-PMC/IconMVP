import { Aurora } from "@/components/aurora";
import { SiteHeader } from "@/components/site-header";

// Esqueleto del feed mientras carga el server component (grupo 9).
export default function FeedLoading() {
  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <SiteHeader />
        <h1 className="mt-8 mb-4 text-3xl font-medium tracking-tight text-forest">Explorar</h1>
        <div className="glass mb-4 h-[60px] animate-pulse rounded-2xl" />
        <div className="mb-4 flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 shrink-0 animate-pulse rounded-full bg-white/50" />
          ))}
        </div>
        <div className="columns-2 gap-4 md:columns-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="mb-4 break-inside-avoid">
              <div
                className="animate-pulse rounded-2xl bg-white/50"
                style={{ aspectRatio: "4 / 5" }}
              />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-white/50" />
              <div className="mt-1.5 h-3 w-1/3 animate-pulse rounded bg-white/40" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
