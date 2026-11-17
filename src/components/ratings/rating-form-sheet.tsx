"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, StarIcon } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { StarRating } from "@/components/star-rating";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RATING_BODY } from "@/lib/rating-rules";
import { deleteRating, saveRating } from "@/app/(app)/marca/[slug]/ratings-actions";

/** Escribir o editar la reseña propia (spec 011, US1). */
export function RatingFormSheet({ brandId, brandName, initial }: { brandId: string; brandName: string; initial?: { stars: number; body: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState<{ msg: string; field?: "stars" | "body" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const len = body.trim().length;

  function submit() {
    setError(null);
    if (!stars) return setError({ msg: "Elige de 1 a 5 estrellas.", field: "stars" });
    if (len < RATING_BODY.min) return setError({ msg: `Escribe al menos ${RATING_BODY.min} caracteres.`, field: "body" });
    start(async () => {
      const r = await saveRating(brandId, { stars, body });
      if (!r.ok) return setError({ msg: r.error, field: r.field });
      toast.success(initial ? "Actualizamos tu reseña." : "Publicamos tu reseña. ¡Gracias!");
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const r = await deleteRating(brandId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Borraste tu reseña.");
      setConfirmDelete(false);
      setOpen(false);
      setStars(0);
      setBody("");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant={initial ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {initial ? <PencilIcon data-icon="inline-start" /> : <StarIcon data-icon="inline-start" />}
        {initial ? "Editar tu reseña" : "Escribir reseña"}
      </Button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title={initial ? "Editar tu reseña" : `Reseña de ${brandName}`}
        description="Cuenta cómo te fue con sus prendas: calidad, tallas, envío, atención."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {initial ? (
              <Button variant="ghost" disabled={pending} onClick={() => setConfirmDelete(true)}>
                Borrar
              </Button>
            ) : (
              <span />
            )}
            <Button loading={pending} onClick={submit}>
              {initial ? "Guardar" : "Publicar reseña"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-label text-text">Tu calificación</legend>
            <StarRating mode="input" name="stars" value={stars} onChange={setStars} invalid={error?.field === "stars"} />
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rating-body" className="text-label text-text">
              Tu reseña
            </label>
            <Textarea
              id="rating-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={RATING_BODY.max}
              rows={5}
              placeholder="Ej.: La tela es buena y la talla fue exacta. El envío a Medellín tardó 3 días."
              aria-invalid={error?.field === "body" || undefined}
              aria-describedby="rating-body-hint"
            />
            <p id="rating-body-hint" className="flex justify-between text-[13px] text-text-muted">
              <span>Mínimo {RATING_BODY.min} caracteres.</span>
              <span className="tabular-nums">
                {len}/{RATING_BODY.max}
              </span>
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error.msg}
            </p>
          )}
        </div>
      </ResponsiveSheet>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Borrar tu reseña?"
        description="Se quita de la página de la marca y del promedio."
        confirmLabel="Borrar"
        onConfirm={remove}
      />
    </>
  );
}
