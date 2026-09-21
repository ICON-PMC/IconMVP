"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ChipSelect, type ChipOption } from "@/components/chip-select";
import { Button } from "@/components/ui/button";
import { setPostTags } from "../../../actions";

export function TagsForm({
  postId,
  occasions,
  styles,
  temperatures,
  selected,
}: {
  postId: string;
  occasions: ChipOption[];
  styles: ChipOption[];
  temperatures: ChipOption[];
  selected: string[];
}) {
  const [pending, start] = useTransition();
  // Cada grupo recibe solo sus ids: ChipSelect emite un hidden input por id elegido.
  const only = (opts: ChipOption[]) => selected.filter((id) => opts.some((o) => o.id === id));

  return (
    <form
      action={(fd) =>
        start(async () => {
          await setPostTags(fd);
          toast.success("Etiquetas guardadas.");
        })
      }
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="post_id" value={postId} />
      <ChipSelect legend="Ocasión" name="occasions" options={occasions} defaultSelected={only(occasions)} />
      <ChipSelect legend="Estilo" name="styles" options={styles} defaultSelected={only(styles)} />
      <ChipSelect legend="Temperatura" name="temperatures" options={temperatures} defaultSelected={only(temperatures)} />
      <Button type="submit" disabled={pending} size="lg" className="w-full rounded-full sm:w-auto sm:self-start sm:px-8">
        {pending ? "Guardando…" : "Guardar etiquetas"}
      </Button>
    </form>
  );
}
