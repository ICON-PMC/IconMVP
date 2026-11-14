// Imagen → huella visual de 512 números, normalizada (norma 1) para comparar por coseno.
// Preprocesado de CLIP: lado corto a 224 (bicúbico), recorte centrado 224×224, RGB,
// escala 0–1 y normalización con la media/desviación de OpenAI CLIP.
import { EMBEDDING_DIM, getVisualSession } from "./model";

const SIZE = 224;
const MEAN = [0.48145466, 0.4578275, 0.40821073];
const STD = [0.26862954, 0.26130258, 0.27577711];

async function toPixelValues(input: Buffer | Uint8Array): Promise<Float32Array> {
  const sharp = (await import("sharp")).default; // lazy: nunca a nivel de módulo (principio V)
  const { data } = await sharp(input)
    .rotate() // respeta la orientación EXIF
    .flatten({ background: "#ffffff" }) // transparencias a blanco
    .resize(SIZE, SIZE, { fit: "cover", position: "centre", kernel: "cubic" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // HWC (RGB) → CHW normalizado
  const out = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * SIZE * SIZE + i] = (data[i * 3 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return out;
}

export function normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

/** Huella visual normalizada de una imagen (JPEG/PNG/WebP/…). */
export async function embedImage(input: Buffer | Uint8Array): Promise<Float32Array> {
  const [{ ort, session }, pixels] = await Promise.all([getVisualSession(), toPixelValues(input)]);
  const feeds = { [session.inputNames[0]]: new ort.Tensor("float32", pixels, [1, 3, SIZE, SIZE]) };
  const results = await session.run(feeds);
  // El export de transformers.js expone `image_embeds` (ya proyectado a 512).
  const out = results.image_embeds ?? results[session.outputNames[0]];
  const vec = out.data as Float32Array;
  if (vec.length !== EMBEDDING_DIM) throw new Error(`Salida inesperada del modelo (${vec.length}).`);
  return normalize(Float32Array.from(vec));
}

/** Formato de pgvector: "[0.1,0.2,…]". */
export function toPgVector(v: ArrayLike<number>): string {
  return `[${Array.from(v, (x) => Number(x.toFixed(6))).join(",")}]`;
}

/** Coseno entre dos vectores ya normalizados. */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
