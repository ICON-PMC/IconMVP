import { AwsV4Signer } from "aws4fetch";

function r2Config() {
  const endpoint = process.env.R2_S3_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Faltan variables de R2 (R2_S3_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).",
    );
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

// Sube un objeto a Cloudflare R2 (S3 API) y devuelve su clave.
// Solo servidor: usa R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY (nunca exponer al cliente).
export async function uploadToR2(
  key: string,
  body: Uint8Array | Buffer | ArrayBuffer | string,
  contentType: string,
): Promise<string> {
  const { endpoint, bucket, accessKeyId, secretAccessKey } = r2Config();

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

/**
 * Borra objetos de R2. Nunca lanza: un archivo huérfano es mejor que un borrado que falla a la
 * mitad (la fila ya se borró). Devuelve las claves que no se pudieron borrar y las registra.
 * Ignora valores que son URLs (datos de muestra que no viven en el bucket).
 */
export async function deleteFromR2(keys: (string | null | undefined)[]): Promise<string[]> {
  const clean = [...new Set(keys.filter((k): k is string => !!k && !/^https?:\/\//.test(k)))].map(
    (k) => k.replace(/^\//, ""),
  );
  if (!clean.length) return [];
  let config: ReturnType<typeof r2Config>;
  try {
    config = r2Config();
  } catch (e) {
    console.error("[r2] no se borraron", clean.length, "objetos:", e instanceof Error ? e.message : e);
    return clean;
  }
  const { endpoint, bucket, accessKeyId, secretAccessKey } = config;

  const results = await Promise.all(
    clean.map(async (key) => {
      try {
        const signer = new AwsV4Signer({
          url: `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`,
          method: "DELETE",
          accessKeyId,
          secretAccessKey,
          region: "auto",
          service: "s3",
        });
        const signed = await signer.sign();
        const res = await fetch(signed.url.toString(), { method: "DELETE", headers: signed.headers });
        // S3 responde 204 también si la clave no existe.
        if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
        return null;
      } catch (e) {
        console.error(`[r2] DELETE ${key} falló:`, e instanceof Error ? e.message : e);
        return key;
      }
    }),
  );
  return results.filter((k): k is string => k !== null);
}
