import { uploadVariants } from "@/lib/image-variants";
import { uploadToR2 } from "@/lib/r2";
import { assertStorageQuota } from "@/lib/storage-quota";

// `bytes` es el peso de la imagen principal (lo único que cuenta para la cuota). `variantsReady`
// indica si también quedaron las variantes de 320 y 640 px (spec 006): guardarlo en
// `variants_ready` / `logo_variants_ready`; si es false, el cron diario las completa.
export type UploadedImage = {
  key: string;
  bytes: number;
  variantsReady: boolean;
  /** Medidas de la imagen principal (spec 007: el feed usa la proporción real de cada foto). */
  width: number | null;
  height: number | null;
};

// Si se pasa, la subida se bloquea cuando supera la cuota de esa marca (solo subidas de la
// propia marca; el staff sube en su nombre sin bloqueo, pero el peso igual cuenta).
export type UploadOptions = { enforceQuotaFor?: string };

// sharp se importa de forma perezosa a propósito: importarlo a nivel de módulo hacía que
// el render de páginas que lo importan diera 500 en el runtime serverless de Vercel.
async function resizeAndUpload(
  buf: Buffer,
  keyPrefix: string,
  opts: UploadOptions,
): Promise<UploadedImage> {
  const { default: sharp } = await import("sharp");
  const { data: out, info } = await sharp(buf)
    .rotate() // respeta la orientación EXIF antes de medir
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  if (opts.enforceQuotaFor) await assertStorageQuota(opts.enforceQuotaFor, out.length);
  // Clave única en cada subida (spec 006, US5): las fotos se sirven con caché larga e inmutable, así
  // que una clave nunca se reutiliza; reemplazar una foto = clave nueva + borrar la anterior.
  const key = `${keyPrefix}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.webp`;
  await uploadToR2(key, out, "image/webp", { immutable: true });
  const variantsReady = await uploadVariants(key, out);
  return { key, bytes: out.length, variantsReady, width: info.width ?? null, height: info.height ?? null };
}

// Procesa un File de un formulario (resize a WebP) y lo sube a R2; devuelve clave y peso, o null.
export async function uploadImageField(
  formData: FormData,
  keyPrefix: string,
  field = "image",
  opts: UploadOptions = {},
): Promise<UploadedImage | null> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return resizeAndUpload(buf, keyPrefix, opts);
}

// Descarga una imagen desde una URL externa (p.ej. el CDN firmado de Instagram, que expira
// en horas) y la sube a R2 ya redimensionada. La usa la importación de Instagram: la foto
// no se puede enlazar en caliente porque su URL deja de servir poco después.
export async function uploadImageFromUrl(
  url: string,
  keyPrefix: string,
  opts: UploadOptions = {},
): Promise<UploadedImage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return resizeAndUpload(buf, keyPrefix, opts);
}
