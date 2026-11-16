import { Aurora } from "@/components/aurora";
import { SiteHeader } from "@/components/site-header";

// Esqueleto de las fichas (prenda, look, marca) mientras carga el servidor (spec 006, US4): al tocar
// una tarjeta se ve de inmediato la estructura de la página, con las mismas proporciones.
export function DetailSkeleton({ variant }: { variant: "garment" | "post" | "brand" }) {
  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-5xl px-4 py-6" role="status" aria-label="Cargando">
        <SiteHeader />
        <div className="mt-6 h-4 w-28 animate-pulse rounded bg-white/50" />
        {variant === "brand" ? (
          <>
            <div className="mt-4 h-40 animate-pulse rounded-3xl bg-white/50" />
            <div className="mt-4 h-8 w-1/2 animate-pulse rounded bg-white/50" />
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/50" />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div className="aspect-[4/5] w-full animate-pulse rounded-2xl bg-white/50" />
            <div className="flex flex-col gap-3">
              <div className="h-40 animate-pulse rounded-2xl bg-white/50" />
              <div className="h-12 animate-pulse rounded-full bg-white/50" />
              {variant === "post" &&
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/40" />
                ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
