"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CameraIcon, ImageIcon, Loader2Icon } from "lucide-react";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { useMediaQuery } from "@/lib/use-media-query";
import { fileToDataUrl, saveVisualSession, searchByPhoto, shrink } from "@/lib/visual/client";

const LOGIN_HREF = `/login?aviso=${encodeURIComponent("Inicia sesión para buscar por foto.")}`;

/**
 * Ícono de cámara del buscador (spec 005, US1). Solo con sesión: sin ella lleva a iniciar sesión.
 * En móvil abre la cámara directamente (la hoja con "Elegir de la galería" queda detrás, para
 * errores y para quien prefiera una foto guardada); en escritorio, subir o arrastrar.
 * Precarga el modelo al abrirse.
 */
export function CameraButton({
  className,
  isLoggedIn = false,
  label,
}: {
  className?: string;
  isLoggedIn?: boolean;
  /** Texto visible junto al ícono (p. ej. "Subir otra foto"); sin él es solo el ícono. */
  label?: string;
}) {
  const mobile = useMediaQuery("(max-width: 767px)");
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
      // Nueva foto: sin filtros previos y con el recorte en la foto completa.
      router.push(`/feed?visual=1&t=${Date.now()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos buscar con esa foto.");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  const buttonClass =
    className ??
    "bg-surface-raised border-[1.5px] border-line text-text focus:border-line-strong focus:outline-none flex size-10 shrink-0 items-center justify-center rounded-full text-ink/70 hover:bg-surface-sunken hover:text-forest";

  if (!isLoggedIn)
    return (
      <Link href={LOGIN_HREF} aria-label="Buscar por foto (inicia sesión)" title="Buscar por foto" className={buttonClass}>
        <CameraIcon className="size-5" />
        {label}
      </Link>
    );

  const option =
    "bg-surface-raised border-[1.5px] border-line text-text focus:border-line-strong focus:outline-none flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-ink hover:bg-surface-sunken disabled:opacity-60";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          handleOpenChange(true);
          // En el celular lo primero es la cámara: el clic del usuario permite abrirla aquí mismo.
          if (mobile) cameraRef.current?.click();
        }}
        aria-label="Buscar por foto"
        title="Buscar por foto"
        className={buttonClass}
      >
        <CameraIcon className="size-5" />
        {label}
      </button>

      {/* Fuera de la hoja: deben existir antes de abrirla para que el clic abra la cámara. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

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
