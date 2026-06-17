import { AwsClient } from "aws4fetch";

// Sube un objeto a Cloudflare R2 (S3 API) y devuelve su clave.
// Solo servidor: usa R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY (nunca exponer al cliente).
export async function uploadToR2(
  key: string,
  body: Uint8Array | Buffer | ArrayBuffer | string,
  contentType: string,
): Promise<string> {
  const endpoint = process.env.R2_S3_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Faltan variables de R2 (R2_S3_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).",
    );
  }

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    region: "auto",
    service: "s3",
  });

  const cleanKey = key.replace(/^\//, "");
  const url = `${endpoint.replace(/\/$/, "")}/${bucket}/${cleanKey}`;
  const res = await aws.fetch(url, {
    method: "PUT",
    body: body as BodyInit,
    headers: { "Content-Type": contentType },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 PUT ${cleanKey} falló: ${res.status} ${text.slice(0, 200)}`);
  }
  return cleanKey;
}
