"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setPendingBrandStub } from "./actions";

/** Spec 010, US3: la marca mencionada que la solicitud dice ser, con opción de quitarla. */
export function PendingStub({ brandId, stub }: { brandId: string; stub: { name: string; mentions: number; status: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const claimed = stub.status !== "open";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2 text-sm text-text">
      <span className="min-w-0 flex-1">
        Indicó ser: <strong>{stub.name}</strong> ({stub.mentions} {stub.mentions === 1 ? "mención" : "menciones"})
        {claimed && <span className="block text-[13px] text-danger">Esa marca mencionada ya fue asignada a otra marca: al aprobar no hereda nada.</span>}
        {!claimed && <span className="block text-[13px] text-text-muted">Al aprobarla, esos looks quedan conectados a su página.</span>}
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setPendingBrandStub(brandId, null);
            if (!r.ok) return void toast.error(r.error);
            toast.success("Quitamos la marca mencionada de la solicitud.");
            router.refresh();
          })
        }
      >
        Quitar
      </Button>
    </div>
  );
}
