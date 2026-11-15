"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, ImageIcon, Loader2Icon } from "lucide-react";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { fileToDataUrl, saveVisualSession, searchByPhoto, shrink } from "@/lib/visual/client";

/**
 * Ícono de cámara del buscador (spec 005, US1). En móvil ofrece "Tomar foto" (abre la cámara) y
 * "Elegir de la galería"; en escritorio, subir o arrastrar. Precarga el modelo al abrirse.
 */
export function CameraButton({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      setError(null);
      fetch("/api/visual/warmup").catch(() => {});
    }
    setOpen(next);
  }

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      setError("El archivo debe ser una imagen (JPG, PNG, WebP o HEIC).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const original = await shrink(await fileToDataUrl(file));
      const res = await searchByPhoto(original.blob);
      saveVisualSession({ original: original.dataUrl, query: original.dataUrl, embedding: res.embedding });
      setOpen(false);
      router.push(`/feed?visual=1&t=${Date.now()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos buscar con esa foto.");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  const option =
    "glass-input flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-ink hover:bg-white/70 disabled:opacity-60";

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        aria-label="Buscar por foto"
        title="Buscar por foto"
        className={
          className ??
          "glass-input flex size-10 shrink-0 items-center justify-center rounded-full text-ink/70 hover:bg-white/70 hover:text-forest"
        }
      >
        <CameraIcon className="size-5" />
      </button>

      <ResponsiveSheet
        open={open}
        onOpenChange={handleOpenChange}
        title="Buscar por foto"
        description="Toma o sube una foto de una prenda y te mostramos las más parecidas de marcas colombianas."
      >
        <div
          className={`flex flex-col gap-3 rounded-2xl border-2 border-dashed p-4 transition-colors ${
            dragging ? "border-forest bg-forest/5" : "border-transparent"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          <button type="button" className={`${option} md:hidden`} disabled={busy} onClick={() => cameraRef.current?.click()}>
            <CameraIcon className="size-5 text-forest" /> Tomar foto
          </button>
          <button type="button" className={option} disabled={busy} onClick={() => galleryRef.current?.click()}>
            <ImageIcon className="size-5 text-forest" />
            <span>
              <span className="md:hidden">Elegir de la galería</span>
              <span className="hidden md:inline">Subir una foto o arrastrarla aquí</span>
            </span>
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {busy && (
            <p className="flex items-center gap-2 text-sm text-ink/60" role="status">
              <Loader2Icon className="size-4 animate-spin" /> Buscando prendas parecidas…
            </p>
          )}
          {error && (
            <p className="text-sm text-coral" role="alert">
              {error}
            </p>
          )}
          <p className="text-xs text-ink/50">
            Usamos la foto solo para esta búsqueda: no la guardamos ni la compartimos.
          </p>
        </div>
      </ResponsiveSheet>
    </>
  );
}
