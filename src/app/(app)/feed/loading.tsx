import { FeedSkeletonGrid } from "@/components/feed/feed-skeleton";

// Esqueleto del feed mientras carga el server component (grupo 9).
export default function FeedLoading() {
  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="mt-8 mb-4 text-3xl font-medium tracking-tight text-forest">Explorar</h1>
        <div className="bg-surface-raised border border-line mb-4 h-[60px] animate-pulse rounded-2xl" />
        <div className="mb-4 flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 shrink-0 animate-pulse rounded-full bg-surface-sunken" />
          ))}
        </div>
        <FeedSkeletonGrid />
      </div>
    </>
  );
}
