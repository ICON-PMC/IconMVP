import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { imageUrl } from "@/lib/images";

export type LookRow = {
  id: string;
  caption: string | null;
  status: string;
  cf_image_id: string | null;
  items: number;
};

export function LooksTab({ looks, canImport }: { looks: LookRow[]; canImport: boolean }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Looks (${looks.length})`}
        description="Fotos de outfits con tus prendas taggeadas."
        action={
          canImport ? (
            <Button
              nativeButton={false}
              render={<Link href="/marca/panel/import" />}
              variant="outline"
              className="rounded-full"
            >
              Importar
            </Button>
          ) : undefined
        }
      />
      {looks.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {looks.map((p) => {
            const img = imageUrl(p.cf_image_id);
            return (
              <li key={p.id}>
                <Link
                  href={`/marca/panel/post/${p.id}`}
                  className="glass-input block rounded-2xl p-2 transition-colors hover:bg-white/70"
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt={p.caption ?? "Look"}
                      className="mb-2 aspect-[3/4] w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="mb-2 aspect-[3/4] w-full rounded-xl bg-ink/5" aria-hidden />
                  )}
                  <div className="flex items-center justify-between gap-1">
                    <StatusBadge status={p.status} />
                    <span className="text-xs text-ink/60">
                      {p.items} {p.items === 1 ? "prenda" : "prendas"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="Aún no tienes looks"
          description={
            canImport
              ? "Importa fotos desde Instagram; quedan como borrador hasta que taggees una prenda."
              : "Conecta Instagram desde el Resumen para importar tus primeras fotos."
          }
        />
      )}
    </div>
  );
}
