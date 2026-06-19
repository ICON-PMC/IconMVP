import { AwsV4Signer } from "aws4fetch";

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

  // Normaliza a un Uint8Array respaldado por ArrayBuffer (longitud conocida y sin el
  // genérico ArrayBufferLike que rechazan BodyInit/BlobPart).
  const src =
    typeof body === "string"
      ? new TextEncoder().encode(body)
      : body instanceof ArrayBuffer
        ? new Uint8Array(body)
        : body;
  const bytes = new Uint8Array(src);

  const cleanKey = key.replace(/^\//, "");
  const url = `${endpoint.replace(/\/$/, "")}/${bucket}/${cleanKey}`;

  // Firmamos con los bytes (X-Amz-Content-Sha256 correcto) y enviamos un Blob en un
  // fetch directo. aws4fetch.fetch envolvía el Buffer en un Request y undici (runtime
  // de Vercel) lo mandaba con Transfer-Encoding: chunked SIN Content-Length → R2
  // devolvía 411 MissingContentLength. Un Blob garantiza que undici fije Content-Length.
  const signer = new AwsV4Signer({
    url,
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: bytes,
    accessKeyId,
    secretAccessKey,
    region: "auto",
    service: "s3",
  });
  const signed = await signer.sign();

  const res = await fetch(signed.url.toString(), {
    method: signed.method,
    headers: signed.headers,
    body: new Blob([bytes]),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 PUT ${cleanKey} falló: ${res.status} ${text.slice(0, 200)}`);
  }
  return cleanKey;
}
