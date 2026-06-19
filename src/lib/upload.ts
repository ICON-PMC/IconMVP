import { uploadToR2 } from "@/lib/r2";

// Procesa un File de un formulario (resize a WebP) y lo sube a R2; devuelve la clave o null.
// sharp se importa de forma perezosa a propósito: importarlo a nivel de módulo hacía que
// el render de páginas que lo importan diera 500 en el runtime serverless de Vercel.
export async function uploadImageField(
  formData: FormData,
  keyPrefix: string,
  field = "image",
): Promise<string | null> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  const { default: sharp } = await import("sharp");
  const buf = Buffer.from(await file.arrayBuffer());
  const out = await sharp(buf)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const key = `${keyPrefix}/0.webp`;
  await uploadToR2(key, out, "image/webp");
  return key;
}
