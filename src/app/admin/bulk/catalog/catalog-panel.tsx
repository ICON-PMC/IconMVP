"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RunForm, type BrandOption } from "./run-form";
import { RunProgress } from "./run-progress";
import { discardCatalogRun } from "./actions";

export type ResumableRun = { id: string; brandName: string; sourceLabel: string; label: string };

// Contenedor de la sección "Leer catálogo de una tienda": formulario, avance y corridas retomables.
export function CatalogPanel({
  brands,
  hasDefaultContact,
  resumable,
}: {
  brands: BrandOption[];
  hasDefaultContact: boolean;
  resumable: ResumableRun[];
}) {
  const router = useRouter();
  const [active, setActive] = useState<{ id: string; warnings: string[] } | null>(null);
  const [pending, start] = useTransition();

  if (active)
    return (
      <RunProgress
        runId={active.id}
        initialWarnings={active.warnings}
        onClose={() => {
          setActive(null);
          router.refresh();
        }}
      />
    );

  return (
    <div className="space-y-5">
      {resumable.length > 0 && (
        <ul className="space-y-2">
          {resumable.map((r) => (
            <li key={r.id} className="rounded-xl bg-leaf-soft px-3 py-3 text-sm text-forest-deep">
              <p className="font-medium">
                Corrida sin terminar de {r.brandName} <span className="font-normal text-forest-deep/70">({r.sourceLabel})</span>
              </p>
              <p className="text-forest-deep/70">{r.label}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" className="rounded-full" onClick={() => setActive({ id: r.id, warnings: [] })}>
                  Continuar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await discardCatalogRun(r.id);
                      router.refresh();
                    })
                  }
                >
                  Empezar de nuevo
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <RunForm
        brands={brands}
        hasDefaultContact={hasDefaultContact}
        onStarted={(id, warnings) => setActive({ id, warnings })}
      />
    </div>
  );
}
