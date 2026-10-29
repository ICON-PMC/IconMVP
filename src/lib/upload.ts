import { uploadToR2 } from "@/lib/r2";
import { assertStorageQuota } from "@/lib/storage-quota";

export type UploadedImage = { key: string; bytes: number };

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
  const out = await sharp(buf)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  if (opts.enforceQuotaFor) await assertStorageQuota(opts.enforceQuotaFor, out.length);
  const key = `${keyPrefix}/0.webp`;
  await uploadToR2(key, out, "image/webp");
  return { key, bytes: out.length };
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
