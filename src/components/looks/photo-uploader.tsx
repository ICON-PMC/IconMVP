"use client";

import { useId, useRef, useState, useTransition } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CameraIcon, ImagePlusIcon, Loader2Icon, RotateCwIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { R2Image } from "@/components/r2-image";
import { Button } from "@/components/ui/button";
import { shrinkImage } from "@/lib/image-client";
import type { LookImage } from "@/lib/look-rules";
import { addLookImage, createLook, removeLookImage, reorderLookImages } from "@/app/(app)/crear/actions";
import { cn } from "@/lib/utils";

type Pending = { tempId: string; preview: string; blob: Blob | null; status: "uploading" | "error"; error?: string };

/**
 * Fotos del look (spec 008, contracts §7). Reduce cada foto a 2000 px en el navegador antes de subir
 * (una por petición), muestra el progreso por foto, permite reintentar la que falle, reordenar y
 * quitar. Sin `postId`, la primera foto crea el borrador y abre el editor.
 */
export function PhotoUploader({
  postId,
  images,
  max = 4,
  disabled = false,
}: {
  postId: string | null;
  images: LookImage[];
  max?: number;
  disabled?: boolean;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const statusId = useId();

  const room = max - images.length - pending.filter((p) => p.status === "uploading").length;

  async function upload(blob: Blob, tempId: string) {
    const fd = new FormData();
    fd.set("image", blob, "foto.jpg");
    if (!postId) {
      setStatus("Subiendo tu foto…");
      const res = await createLook(fd); // redirige al editor si sale bien
      if (res && !res.ok) {
        setPending((list) => list.map((p) => (p.tempId === tempId ? { ...p, status: "error", error: res.error } : p)));
        setStatus(res.error);
      }
      return;
    }
    const res = await addLookImage(postId, fd);
    if (res.ok) {
      setPending((list) => list.filter((p) => p.tempId !== tempId));
      setStatus("Foto agregada.");
    } else {
      setPending((list) => list.map((p) => (p.tempId === tempId ? { ...p, status: "error", error: res.error } : p)));
      setStatus(res.error);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const chosen = [...files].slice(0, Math.max(0, postId ? room : 1));
    if (files.length > chosen.length) toast.info(`Un look puede tener hasta ${max} fotos.`);
    for (const file of chosen) {
      const tempId = crypto.randomUUID();
      setPending((list) => [...list, { tempId, preview: "", blob: null, status: "uploading" }]);
      try {
        const { blob, dataUrl } = await shrinkImage(file, { maxSide: 2000, quality: 0.9 });
        setPending((list) => list.map((p) => (p.tempId === tempId ? { ...p, preview: dataUrl, blob } : p)));
        await upload(blob, tempId);
      } catch (e) {
        const error = e instanceof Error ? e.message : "No pudimos leer esa foto.";
        setPending((list) => list.map((p) => (p.tempId === tempId ? { ...p, status: "error", error } : p)));
        setStatus(error);
      }
    }
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function retry(p: Pending) {
    if (!p.blob) return;
    setPending((list) => list.map((x) => (x.tempId === p.tempId ? { ...x, status: "uploading", error: undefined } : x)));
    void upload(p.blob, p.tempId);
  }

  function remove(imageId: string) {
    if (!postId) return;
    startTransition(async () => {
      const res = await removeLookImage(postId, imageId);
      if (!res.ok) toast.error(res.error);
      else setStatus("Foto quitada.");
    });
  }

  function move(index: number, dir: -1 | 1) {
    if (!postId) return;
    const ids = images.map((i) => i.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    startTransition(async () => {
      const res = await reorderLookImages(postId, ids);
      if (!res.ok) toast.error(res.error);
      else setStatus(j === 0 ? "Ahora es la foto principal." : "Orden cambiado.");
    });
  }

  const inputs = (
    <>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple={Boolean(postId)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      <p id={statusId} role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
    </>
  );

  // Primera foto: crea el borrador.
  if (!postId) {
    const p = pending[0];
    return (
      <div className="flex flex-col gap-3">
        {inputs}
        <div className="relative flex aspect-[4/5] max-h-[46dvh] w-full max-w-sm flex-col items-center justify-center gap-4 self-center overflow-hidden rounded-[var(--radius-photo)] border-[1.5px] border-dashed border-line-strong bg-surface-sunken px-6 text-center">
          {p?.preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local (dataURL)
            <img src={p.preview} alt="" className="absolute inset-0 size-full object-cover opacity-70" />
          ) : null}
          <div className="relative flex flex-col items-center gap-3">
            {p?.status === "uploading" ? (
              <>
                <Loader2Icon className="size-8 animate-spin text-text" aria-hidden />
                <p className="text-label text-text">Subiendo tu foto…</p>
              </>
            ) : (
              <>
                <span className="flex size-14 items-center justify-center rounded-full bg-surface-raised text-text">
                  <ImagePlusIcon className="size-6" aria-hidden />
                </span>
                <p className="text-h3 text-text">Sube la foto de tu look</p>
                <p className="text-sm text-text-muted">Después etiquetas las prendas, el estilo y la ocasión.</p>
                {p?.status === "error" && (
                  <p role="alert" className="text-sm font-medium text-danger">
                    {p.error}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            size="lg"
            className="md:hidden"
            disabled={disabled || p?.status === "uploading"}
            onClick={() => {
              setPending([]);
              cameraRef.current?.click();
            }}
          >
            <CameraIcon data-icon="inline-start" /> Tomar foto
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="max-md:hidden"
            disabled={disabled || p?.status === "uploading"}
            onClick={() => {
              setPending([]);
              galleryRef.current?.click();
            }}
          >
            <ImagePlusIcon data-icon="inline-start" /> Subir foto
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="md:hidden"
            disabled={disabled || p?.status === "uploading"}
            onClick={() => {
              setPending([]);
              galleryRef.current?.click();
            }}
          >
            Elegir de la galería
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {inputs}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Fotos del look">
        {images.map((img, i) => (
          <li key={img.id} className="relative">
            <div className="aspect-[4/5] overflow-hidden rounded-[var(--radius-photo)] bg-surface-sunken">
              <R2Image image={img.key} alt={`Foto ${i + 1}`} sizes="(min-width: 640px) 160px, 45vw" className="size-full object-cover" />
            </div>
            {i === 0 && (
              <span className="absolute top-2 left-2 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-semibold text-text">
                Principal
              </span>
            )}
            {!disabled && (
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Mover la foto ${i + 1} antes`}
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowLeftIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Mover la foto ${i + 1} después`}
                    disabled={busy || i === images.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowRightIcon />
                  </Button>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Quitar la foto ${i + 1}`} disabled={busy} onClick={() => remove(img.id)}>
                  <XIcon />
                </Button>
              </div>
            )}
          </li>
        ))}
        {pending.map((p) => (
          <li key={p.tempId} className="relative">
            <div
              className={cn(
                "relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[var(--radius-photo)] bg-surface-sunken",
                p.status === "error" && "ring-2 ring-danger",
              )}
            >
              {p.preview && (
                // eslint-disable-next-line @next/next/no-img-element -- vista previa local (dataURL)
                <img src={p.preview} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
              )}
              {p.status === "uploading" ? (
                <Loader2Icon className="relative size-6 animate-spin text-text" aria-label="Subiendo" />
              ) : (
                <div className="relative flex flex-col items-center gap-1 px-2 text-center">
                  <p className="text-xs font-semibold text-danger">{p.error}</p>
                  <div className="flex gap-1">
                    {p.blob && (
                      <Button size="sm" variant="secondary" onClick={() => retry(p)}>
                        <RotateCwIcon data-icon="inline-start" /> Reintentar
                      </Button>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Descartar"
                      onClick={() => setPending((l) => l.filter((x) => x.tempId !== p.tempId))}
                    >
                      <XIcon />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </li>
        ))}
        {!disabled && room > 0 && (
          <li>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-photo)] border-[1.5px] border-dashed border-line-strong text-text-muted transition-colors hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:outline-none"
            >
              <ImagePlusIcon className="size-6" aria-hidden />
              <span className="text-label">Agregar foto</span>
            </button>
          </li>
        )}
      </ul>
      <p className="text-[13px] text-text-muted">
        {images.length} de {max} fotos · la primera es la principal.
      </p>
    </div>
  );
}
