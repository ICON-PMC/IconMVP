"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deletePost } from "../../../actions";

/** Eliminar un look (solo borrador o archivado). Pide confirmación y vuelve a Looks. */
export function DeleteLookButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button
        type="button"
        size="lg"
        variant="destructive"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="w-full rounded-full sm:w-auto sm:px-6"
      >
        Eliminar
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Eliminar este look?"
        description="Se borran la foto y las etiquetas del look. Las prendas de tu catálogo no se tocan. No se puede deshacer."
        onConfirm={() =>
          start(async () => {
            const r = await deletePost(postId);
            if (!r.ok) return void toast.error(r.error);
            router.push("/marca/panel?tab=looks&ok=look-eliminado");
          })
        }
      />
    </>
  );
}
