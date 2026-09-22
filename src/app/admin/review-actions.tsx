"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approveBrand, rejectBrand } from "./actions";

export function ReviewActions({ brandId, brandName }: { brandId: string; brandName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  // La tarjeta desaparece al revalidar, así que el resultado se comunica con ?aviso= en la cola.
  function run(
    kind: "aprobada" | "rechazada",
    action: () => ReturnType<typeof approveBrand>,
    onOk?: () => void,
  ) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) return setError(res.error);
      onOk?.();
      router.replace(`/admin?tab=marcas&aviso=${kind}`);
    });
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <div className="flex gap-2">
        <Button
          disabled={pending}
          onClick={() => run("aprobada", () => approveBrand(brandId))}
          className="flex-1 rounded-full sm:flex-none sm:px-5"
        >
          Aprobar
        </Button>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => setOpen(true)}
          className="flex-1 rounded-full sm:flex-none sm:px-5"
        >
          Rechazar
        </Button>
      </div>
      {error && !open && (
        <p role="alert" className="text-xs text-coral">
          {error}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar a {brandName}</DialogTitle>
            <DialogDescription>
              La nota es opcional; se la enviaremos a la marca para que pueda ajustar su perfil.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor={`note-${brandId}`}>Nota para la marca</Label>
          <Textarea
            id={`note-${brandId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Ej. Las fotos de las prendas no se ven bien; súbelas con luz natural."
          />
          {error && (
            <p role="alert" className="text-sm text-coral">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run("rechazada", () => rejectBrand(brandId, note), () => setOpen(false))}
            >
              {pending ? "Rechazando…" : "Rechazar marca"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
