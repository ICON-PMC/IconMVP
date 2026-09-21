"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPostItemSize, untagGarmentFromPost } from "../../../actions";

export type TaggedItem = { id: string; title: string; price: string | null; sizeId: string | null };

const nativeSelect =
  "glass-input h-11 w-28 shrink-0 rounded-lg px-2 text-base text-ink md:h-8 md:text-sm";

export function TaggedItems({
  postId,
  items,
  sizes,
  wasPublished,
}: {
  postId: string;
  items: TaggedItem[];
  sizes: { id: string; label: string }[];
  wasPublished: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [removing, setRemoving] = useState<TaggedItem | null>(null);

  function changeSize(item: TaggedItem, value: string) {
    start(async () => {
      const r = await setPostItemSize(postId, item.id, value || null);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  function remove(item: TaggedItem) {
    start(async () => {
      // Redirige con ?error= si falla (FlashToast lo muestra); si sale bien, refresca.
      await untagGarmentFromPost(postId, item.id);
      toast.success("Prenda quitada.");
      router.refresh();
    });
  }

  return (
    <>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 rounded-2xl bg-white/60 py-1.5 pr-1.5 pl-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{it.title}</span>
              {it.price && <span className="block text-xs text-ink/60">{it.price}</span>}
            </span>
            {sizes.length > 0 && (
              <select
                aria-label={`Talla de ${it.title}`}
                defaultValue={it.sizeId ?? ""}
                onChange={(e) => changeSize(it, e.target.value)}
                className={nativeSelect}
              >
                <option value="">Talla</option>
                {sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Quitar ${it.title}`}
              onClick={() => setRemoving(it)}
            >
              <XIcon />
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`¿Quitar "${removing?.title ?? ""}" del look?`}
        description={
          wasPublished && items.length === 1
            ? "Es la última prenda: el look volverá a borrador."
            : "La prenda sigue en tu catálogo."
        }
        confirmLabel="Quitar"
        onConfirm={() => {
          if (removing) remove(removing);
          setRemoving(null);
        }}
      />
    </>
  );
}
