"use client";

// Reducción de fotos en el navegador (spec 008, contracts §8). Pasar por <canvas> convierte HEIC
// (iPhone) a JPEG y quita los metadatos EXIF (ubicación, etc.). La usan la búsqueda por foto
// (512 px) y la subida de looks (2000 px: una foto por petición, bajo el límite de 10 MB).

export type Rect = { x: number; y: number; w: number; h: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No pudimos leer esa imagen. Prueba con una foto JPG o PNG."));
    img.src = src;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("No pudimos leer el archivo."));
    r.readAsDataURL(file);
  });
}

/**
 * Reduce a `maxSide` (por defecto 2000 px), convierte a JPEG y quita metadatos.
 * `crop` en fracciones 0–1 de la imagen.
 */
export async function shrinkImage(
  src: File | string,
  opts: { maxSide?: number; quality?: number; crop?: Rect } = {},
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  const { maxSide = 2000, quality = 0.9, crop } = opts;
  const url = typeof src === "string" ? src : await fileToDataUrl(src);
  const img = await loadImage(url);
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sw = img.naturalWidth * c.w;
  const sh = img.naturalHeight * c.h;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no permite procesar la foto.");
  ctx.drawImage(img, img.naturalWidth * c.x, img.naturalHeight * c.y, sw, sh, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No pudimos procesar la foto."))), "image/jpeg", quality),
  );
  return { blob, dataUrl, width: canvas.width, height: canvas.height };
}
