"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TagPicker } from "@/components/looks/tag-picker";
import { LOOK_LIMITS } from "@/lib/look-rules";
import { deleteLook, publishLook, setLookCaption, unpublishLook } from "@/app/(app)/crear/actions";

type Option = { id: string; name: string };

export function TagButton({
  postId,
  categories,
  colors,
  taggedGarmentIds,
  count,
}: {
  postId: string;
  categories: Option[];
  colors: (Option & { hex: string | null })[];
  taggedGarmentIds: string[];
  count: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" /> Etiquetar prenda o marca
      </Button>
      <TagPicker
        postId={postId}
        categories={categories}
        colors={colors}
        open={open}
        onOpenChange={setOpen}
        taggedGarmentIds={taggedGarmentIds}
        full={count >= LOOK_LIMITS.items}
      />
    </>
  );
}

export function CaptionField({ postId, initial, disabled }: { postId: string; initial: string; disabled?: boolean }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== saved.trim();

  function save() {
    if (!dirty) return;
    startTransition(async () => {
      const res = await setLookCaption(postId, value);
      if (!res.ok) return void toast.error(res.error);
      setSaved(value);
      toast.success("Texto guardado.");
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="look-caption" className="text-label text-text">
        Texto <span className="font-normal text-text-muted">(opcional)</span>
      </label>
      <Textarea
        id="look-caption"
        value={value}
        disabled={disabled}
        maxLength={LOOK_LIMITS.caption}
        rows={3}
        placeholder="¿Dónde lo usaste? ¿Qué te gusta de este look?"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
      />
      <div className="flex items-center justify-between text-[13px] text-text-muted">
        <span aria-live="polite">{pending ? "Guardando…" : dirty ? "Sin guardar" : ""}</span>
        <span className="tabular-nums">
          {value.length}/{LOOK_LIMITS.caption}
        </span>
      </div>
    </div>
  );
}

export function PublishActions({
  postId,
  status,
  missing,
  locked,
}: {
  postId: string;
  status: "draft" | "published" | "archived";
  missing: string[];
  locked: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();

  function publish() {
    startTransition(async () => {
      const res = await publishLook(postId);
      if (res && !res.ok) toast.error(res.error);
    });
  }
  function unpublish() {
    startTransition(async () => {
      const res = await unpublishLook(postId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Tu look volvió a borrador.");
        router.refresh();
      }
    });
  }
  function remove() {
    startTransition(async () => {
      const res = await deleteLook(postId);
      if (res && !res.ok) toast.error(res.error);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" disabled={pending} onClick={() => setConfirmDelete(true)}>
          Borrar
        </Button>
        {!locked && status === "published" && (
          <Button variant="secondary" disabled={pending} onClick={unpublish}>
            Despublicar
          </Button>
        )}
        {!locked && status === "published" && (
          <Button render={<a href={`/post/${postId}`} />} nativeButton={false}>
            Ver look
          </Button>
        )}
        {!locked && status !== "published" && (
          <Button size="lg" loading={pending} disabled={pending || missing.length > 0} onClick={publish}>
            Publicar
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Borrar este look?"
        description="Se borran las fotos y las etiquetas. No se puede deshacer."
        confirmLabel="Borrar look"
        onConfirm={remove}
      />
    </>
  );
}
