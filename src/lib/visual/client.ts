"use client";

// Lado del navegador de la búsqueda por foto (spec 005): reducir la foto, guardar la búsqueda en
// sessionStorage (se borra al cerrar la pestaña, FR-012) y llamar a la API.
import type { FeedItem } from "@/lib/feed";

const KEY = "icon.visual.v1";
export const MAX_SIDE = 512;

export type VisualItem = FeedItem & { similarity: number };
export type VisualResponse = {
  embedding: number[];
  detectedCategory: string;
  belowThreshold: boolean;
  items: VisualItem[];
};
export type VisualSession = {
  /** Foto original reducida (para volver a recortar). */
  original: string;
  /** Lo que se buscó (original o recorte), como miniatura. */
  query: string;
  embedding: number[];
};

export function loadVisualSession(): VisualSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as VisualSession) : null;
  } catch {
    return null;
  }
}

export function saveVisualSession(s: VisualSession) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin sessionStorage: la búsqueda funciona, solo no se recuerda al volver */
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No pudimos leer esa imagen. Prueba con una foto JPG o PNG."));
    img.src = src;
  });
}

/**
 * Reduce (y opcionalmente recorta) una imagen a ≤ 512 px y la devuelve como JPEG. Pasar por
 * <canvas> convierte HEIC (iPhone) y quita los metadatos EXIF (ubicación, etc.).
 * `crop` en fracciones 0–1 de la imagen.
 */
export async function shrink(
  src: string,
  crop?: { x: number; y: number; w: number; h: number },
): Promise<{ blob: Blob; dataUrl: string }> {
  const img = await loadImage(src);
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sw = img.naturalWidth * c.w;
  const sh = img.naturalHeight * c.h;
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no permite procesar la foto.");
  ctx.drawImage(img, img.naturalWidth * c.x, img.naturalHeight * c.y, sw, sh, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No pudimos procesar la foto."))), "image/jpeg", 0.85),
  );
  return { blob, dataUrl };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("No pudimos leer el archivo."));
    r.readAsDataURL(file);
  });
}

async function parse(res: Response): Promise<VisualResponse> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "La búsqueda por foto no está disponible por ahora.");
  return body as VisualResponse;
}

/** Búsqueda con una foto nueva (cuenta para el límite de uso). */
export async function searchByPhoto(blob: Blob, query = ""): Promise<VisualResponse> {
  const fd = new FormData();
  fd.set("image", blob, "foto.jpg");
  return parse(await fetch(`/api/visual/search${query}`, { method: "POST", body: fd }));
}

/** Re-búsqueda con el vector guardado (filtros nuevos, recarga, volver atrás). */
export async function searchByEmbedding(embedding: number[], query = ""): Promise<VisualResponse> {
  return parse(
    await fetch(`/api/visual/search${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embedding }),
    }),
  );
}
