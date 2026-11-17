"use client";

import { useRef, useState, useTransition } from "react";
import { CameraIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { removeAvatar, uploadAvatar } from "@/app/(app)/u/[handle]/actions";
import { shrinkImage } from "@/lib/image-client";

/** Foto de perfil (spec 009): se reduce en el navegador, se sube al momento y se ve en círculo. */
export function AvatarUploader({ avatar, name, seed }: { avatar: string | null; name: string; seed: string }) {
  const [current, setCurrent] = useState(avatar);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Elige una foto.");
    startTransition(async () => {
      try {
        const small = await shrinkImage(file, { maxSide: 1024, quality: 0.85 });
        setPreview(small.dataUrl);
        const fd = new FormData();
        fd.set("image", new File([small.blob], "avatar.jpg", { type: small.blob.type || "image/jpeg" }));
        const res = await uploadAvatar(fd);
        if (!res.ok) {
          setPreview(null);
          return void toast.error(res.error);
        }
        setCurrent(res.avatar);
        toast.success("Foto actualizada.");
      } catch {
        setPreview(null);
        toast.error("No pudimos leer esa foto. Intenta con otra.");
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removeAvatar();
      if (!res.ok) return void toast.error(res.error);
      setCurrent(null);
      setPreview(null);
      toast.success("Quitaste tu foto.");
    });
  }

  return (
    <div className="flex items-center gap-4">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="size-24 shrink-0 rounded-full object-cover" />
      ) : (
        <Avatar image={current} name={name} seed={seed} size={96} />
      )}
      <div className="flex flex-col items-start gap-2">
        <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} aria-hidden />
        <Button type="button" variant="secondary" size="sm" loading={pending} disabled={pending} onClick={() => input.current?.click()}>
          <CameraIcon data-icon="inline-start" /> {current || preview ? "Cambiar foto" : "Subir foto"}
        </Button>
        {(current || preview) && (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={remove}>
            <TrashIcon data-icon="inline-start" /> Quitar
          </Button>
        )}
      </div>
    </div>
  );
}
