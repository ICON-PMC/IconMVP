"use client";

import { useState, useTransition } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteLook } from "@/app/(app)/crear/actions";

/** Editar y borrar, solo para quien publicó el look (spec 008, T029). */
export function LookOwnerActions({ postId, canEdit }: { postId: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Button variant="secondary" size="sm" render={<a href={`/crear/${postId}`} />} nativeButton={false}>
          <PencilIcon data-icon="inline-start" /> Editar
        </Button>
      )}
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(true)}>
        <Trash2Icon data-icon="inline-start" /> Borrar
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Borrar este look?"
        description="Se borran las fotos y las etiquetas. No se puede deshacer."
        confirmLabel="Borrar look"
        onConfirm={() =>
          startTransition(async () => {
            const res = await deleteLook(postId);
            if (res && !res.ok) toast.error(res.error);
          })
        }
      />
    </div>
  );
}
