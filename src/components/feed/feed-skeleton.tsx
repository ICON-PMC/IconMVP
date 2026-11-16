// Marcadores de la grilla del feed (spec 006): mismas proporciones que las tarjetas, para que nada
// salte cuando llegan los resultados. Lo usan `feed/loading.tsx` y el Suspense de los resultados.
export function FeedSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="columns-2 gap-3 md:columns-3 md:gap-4 lg:columns-4" role="status" aria-label="Cargando resultados">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mb-4 break-inside-avoid">
          <div className="animate-pulse rounded-[var(--radius-photo)] bg-surface-sunken motion-reduce:animate-none" style={{ aspectRatio: `1 / ${[1.4, 1, 1.8, 1.3, 1.5, 1.2][i % 6]}` }} />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-surface-sunken" />
          <div className="mt-1.5 h-3 w-1/3 animate-pulse rounded bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}
