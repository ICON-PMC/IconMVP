"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { imageUrl } from "@/lib/images";
import { NewLookSheet } from "./new-look-sheet";

export type LookRow = {
  id: string;
  caption: string | null;
  status: string;
  cf_image_id: string | null;
  items: number;
};

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "published", label: "Publicados" },
  { id: "draft", label: "Borradores" },
  { id: "archived", label: "Archivados" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

export function LooksTab({
  looks,
  canImport,
  instagramEnabled,
}: {
  looks: LookRow[];
  canImport: boolean;
  instagramEnabled: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = looks.filter((l) => filter === "all" || l.status === filter);

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Looks (${looks.length})`}
        description="Fotos de outfits con tus prendas taggeadas."
        action={
          <div className="flex flex-wrap gap-2">
            {canImport && (
              <Button
                nativeButton={false}
                render={<Link href="/marca/panel/import" />}
                variant="outline"
                className="rounded-full"
              >
                Importar
              </Button>
            )}
            <NewLookSheet />
          </div>
        }
      />

      {looks.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ToggleGroup
            aria-label="Filtrar por estado"
            value={[filter]}
            onValueChange={(v) => v[0] && setFilter(v[0] as Filter)}
            spacing={1}
            className="min-w-max"
          >
            {FILTERS.map((f) => (
              <ToggleGroupItem
                key={f.id}
                value={f.id}
                className="min-h-11 rounded-full px-4 md:min-h-8 data-[pressed]:bg-forest data-[pressed]:text-white"
              >
                {f.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {visible.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((p) => {
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
          title={looks.length ? "Ningún look con ese estado" : "Aún no tienes looks"}
          description={
            looks.length
              ? "Prueba con otro filtro."
              : canImport
                ? "Sube una foto con «Nuevo look» o impórtala desde Instagram."
                : instagramEnabled
                  ? "Sube una foto con «Nuevo look». También puedes conectar Instagram desde el Resumen."
                  : "Sube una foto con «Nuevo look»."
          }
        />
      )}
    </div>
  );
}
