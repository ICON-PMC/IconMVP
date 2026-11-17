"use client";

// Lado del navegador de la búsqueda por foto (spec 005): reducir la foto, guardar la búsqueda en
// sessionStorage (se borra al cerrar la pestaña, FR-012) y llamar a la API.
import type { FeedItem } from "@/lib/feed";
import { fileToDataUrl, shrinkImage, type Rect } from "@/lib/image-client";

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
  /** Recorte actual sobre `original` (fracciones 0–1); sin él, la foto completa. */
  rect?: { x: number; y: number; w: number; h: number };
};

export function clearVisualSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* sin sessionStorage */
  }
}

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

/**
 * Reduce (y opcionalmente recorta) una imagen a ≤ 512 px y la devuelve como JPEG.
 * `crop` en fracciones 0–1 de la imagen. Usa el reductor general de `image-client`.
 */
export async function shrink(src: string, crop?: Rect): Promise<{ blob: Blob; dataUrl: string }> {
  const { blob, dataUrl } = await shrinkImage(src, { maxSide: MAX_SIDE, quality: 0.85, crop });
  return { blob, dataUrl };
}

export { fileToDataUrl };

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
