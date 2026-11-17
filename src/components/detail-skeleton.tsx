// Esqueleto de las fichas (prenda, look, marca) mientras carga el servidor (spec 006 y 007): mismas
// proporciones que la página real, en los colores del sistema. La navegación la pone el layout (app).
const BLOCK = "animate-pulse bg-surface-sunken motion-reduce:animate-none";

export function DetailSkeleton({ variant }: { variant: "garment" | "post" | "brand" }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6" role="status" aria-label="Cargando">
      <div className={`mb-4 h-5 w-32 rounded-full ${BLOCK}`} />
      {variant === "brand" ? (
        <>
          <div className={`h-56 rounded-[var(--radius-card)] ${BLOCK}`} />
          <div className="mt-6 mb-5 flex gap-5">
            <div className={`h-6 w-20 rounded-full ${BLOCK}`} />
            <div className={`h-6 w-16 rounded-full ${BLOCK}`} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`aspect-[3/4] rounded-[var(--radius-photo)] ${BLOCK}`} />
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10">
          <div className={`aspect-[4/5] w-full rounded-[var(--radius-card)] ${BLOCK}`} />
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className={`size-12 rounded-full ${BLOCK}`} />
              <div className={`h-4 w-32 rounded-full ${BLOCK}`} />
            </div>
            <div className={`h-9 w-4/5 rounded-xl ${BLOCK}`} />
            <div className={`h-6 w-24 rounded-xl ${BLOCK}`} />
            <div className={`h-12 w-full rounded-full ${BLOCK}`} />
            {variant === "post" &&
              Array.from({ length: 2 }).map((_, i) => <div key={i} className={`h-28 rounded-[var(--radius-card)] ${BLOCK}`} />)}
          </div>
        </div>
      )}
    </div>
  );
}
