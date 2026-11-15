// Modelo de visión para la búsqueda por foto (spec 005, research R1).
// FashionCLIP (MIT), encoder de imagen ViT-B/32 cuantizado en ONNX, ejecutado con onnxruntime-web
// en modo WASM: evita el `.so` nativo de onnxruntime-node, que falla en Vercel.
// El archivo NO se empaqueta en la función: se descarga de R2 (VISUAL_MODEL_URL) a /tmp en el
// arranque en frío y la sesión queda viva mientras dure la instancia.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const VISUAL_MODEL = "fashion-clip-vit-b32-q8";
export const EMBEDDING_DIM = 512;

type Ort = typeof import("onnxruntime-web");
type Session = import("onnxruntime-web").InferenceSession;

let sessionPromise: Promise<{ ort: Ort; session: Session }> | null = null;

async function loadModelBytes(): Promise<Uint8Array> {
  const url = process.env.VISUAL_MODEL_URL;
  if (!url) throw new Error("Falta VISUAL_MODEL_URL.");
  const expected = process.env.VISUAL_MODEL_SHA256?.toLowerCase();
  // En local se puede apuntar a un archivo (ruta o file://) en vez de descargarlo.
  if (!/^https?:\/\//.test(url)) return new Uint8Array(await readFile(url.replace(/^file:\/\//, "")));
  const cached = path.join(tmpdir(), `${VISUAL_MODEL}.onnx`);
  if (existsSync(cached)) return new Uint8Array(await readFile(cached));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el modelo (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (expected) {
    const got = createHash("sha256").update(bytes).digest("hex");
    if (got !== expected) throw new Error("El modelo descargado no coincide con VISUAL_MODEL_SHA256.");
  }
  await writeFile(cached, bytes).catch(() => {}); // /tmp lleno o de solo lectura: seguimos en memoria
  return bytes;
}

/** Sesión de inferencia (singleton por instancia). */
export function getVisualSession(): Promise<{ ort: Ort; session: Session }> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.numThreads = 1; // sin workers en funciones serverless
      const session = await ort.InferenceSession.create(await loadModelBytes(), {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      return { ort, session };
    })().catch((e) => {
      sessionPromise = null; // permite reintentar en la siguiente llamada
      throw e;
    });
  }
  return sessionPromise;
}
