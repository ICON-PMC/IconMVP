"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { R2Image } from "@/components/r2-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProposedItem } from "@/lib/claims";
import { convertProposed, disownProposed, linkProposed, requestProposed } from "../claims-actions";
import { GarmentPicker, type PickerGarment } from "./garment-picker";

/** Prenda que un usuario creó con el nombre de la marca, o sin marca (spec 010, US2). */
export function ProposedCard({ item, scope, catalog }: { item: ProposedItem; scope: "mine" | "unbranded"; catalog: PickerGarment[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "No se pudo.");
      toast.success(ok);
      setPicking(false);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface-raised p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-text">{item.name}</p>
        <Badge variant="neutral">{item.categoryName}</Badge>
        {item.conversionGarmentId && <Badge variant="new">En tu catálogo, sin publicar</Badge>}
      </div>
      {item.colors.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
          {item.colors.map((c) => (
            <span key={c.name} className="inline-flex items-center gap-1">
              {c.hex && <span className="size-3 rounded-full ring-1 ring-black/15" style={{ background: c.hex }} aria-hidden />}
              {c.name}
            </span>
          ))}
        </p>
      )}
      <div className="flex items-center gap-2">
        {item.looks.map((l) => (
          <Link key={l.postId} href={`/post/${l.postId}`} target="_blank" className="h-20 w-16 overflow-hidden rounded-[var(--radius-field)] bg-surface-sunken">
            <R2Image image={l.image} alt="Look" sizes="64px" className="size-full object-cover" />
          </Link>
        ))}
        <span className="text-[13px] text-text-muted">
          En {item.usedIn} {item.usedIn === 1 ? "look" : "looks"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {scope === "mine" ? (
          <>
            <Button size="sm" disabled={pending} onClick={() => setPicking(true)}>
              Es esta de mi catálogo
            </Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => convertProposed(item.id), "Abrimos la prenda en tu catálogo.")}>
              {item.conversionGarmentId ? "Completar prenda" : "Agregar a mi catálogo"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => disownProposed(item.id), "Listo: la prenda quedó sin marca.")}>
              No es nuestra
            </Button>
          </>
        ) : item.requested ? (
          <Badge variant="new">Solicitud enviada</Badge>
        ) : item.requestedByOther ? (
          <span className="text-[13px] text-text-muted">Otra marca ya la pidió.</span>
        ) : (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => requestProposed(item.id), "Enviamos tu solicitud al equipo de Icon.")}>
            Es nuestra
          </Button>
        )}
      </div>
      {scope === "mine" && (
        <GarmentPicker
          open={picking}
          onOpenChange={setPicking}
          garments={catalog}
          initialQuery={item.name}
          pending={pending}
          onPick={(g) => run(() => linkProposed(item.id, g.id), `Enlazamos «${item.name}» con ${g.title}.`)}
        />
      )}
    </li>
  );
}
