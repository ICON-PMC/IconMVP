/**
 * Genera src/lib/visual/prompts.json: vectores de texto de FashionCLIP precalculados (spec 005,
 * research R4). Así producción solo necesita el encoder de imagen.
 *   - una frase por categoría de Icon (para priorizar la misma categoría, FR-006)
 *   - frases de "no es ropa" (US2 AS4) y de contenido no permitido (FR-015)
 *
 * Uso (solo local, una vez o al cambiar categorías/modelo):
 *   npx tsx scripts/build-visual-prompts.ts .models/fashion-clip
 * La carpeta debe tener text_model_quantized.onnx + tokenizer.json/tokenizer_config.json.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import * as ort from "onnxruntime-web";
import { AutoTokenizer, env } from "@huggingface/transformers";

const dir = path.resolve(process.argv[2] ?? ".models/fashion-clip");

// Slugs = tags type 'category' de Icon. Varias frases por categoría; se promedian.
const CATEGORIES: Record<string, string[]> = {
  "abrigos-y-tejidos": ["a photo of a knit sweater", "a photo of a hoodie", "a photo of a cardigan", "a photo of a coat"],
  accesorios: ["a photo of a cap", "a photo of jewelry", "a photo of a hair accessory", "a photo of a belt"],
  blusas: ["a photo of a blouse", "a photo of a women's blouse"],
  bolsos: ["a photo of a handbag", "a photo of a bag"],
  calzado: ["a photo of shoes", "a photo of sneakers", "a photo of boots", "a photo of sandals"],
  camisas: ["a photo of a button-up shirt", "a photo of a collared shirt"],
  chaquetas: ["a photo of a jacket", "a photo of a denim jacket", "a photo of a puffer jacket"],
  "enterizos-y-conjuntos": ["a photo of a jumpsuit", "a photo of a matching set", "a photo of a two-piece outfit"],
  faldas: ["a photo of a skirt", "a photo of a midi skirt"],
  jeans: ["a photo of jeans", "a photo of denim pants"],
  pantalones: ["a photo of trousers", "a photo of pants", "a photo of cargo pants"],
  shorts: ["a photo of shorts", "a photo of denim shorts"],
  swimwear: ["a photo of a bikini", "a photo of a swimsuit"],
  tops: ["a photo of a t-shirt", "a photo of a crop top", "a photo of a tank top", "a photo of a graphic tee"],
  vestidos: ["a photo of a dress", "a photo of a maxi dress", "a photo of a mini dress"],
};
const NOT_CLOTHING = [
  "a photo of food", "a landscape photo", "a photo of a car", "a photo of a building",
  "a photo of an animal", "a screenshot of text", "a photo of furniture", "a photo of a phone",
];
const BLOCKED = [
  "a photo of a naked person", "explicit nudity", "a pornographic image",
  "graphic violence and blood", "a photo of a gun",
];

function normalize(v: Float32Array) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return Array.from(v, (x) => Number((x / n).toFixed(6)));
}
function mean(vs: number[][]) {
  const out = new Float32Array(vs[0].length);
  for (const v of vs) v.forEach((x, i) => (out[i] += x / vs.length));
  return normalize(out);
}

async function main() {
  env.allowRemoteModels = false;
  env.localModelPath = path.dirname(dir);
  const tokenizer = await AutoTokenizer.from_pretrained(path.basename(dir));
  ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create(path.join(dir, "text_model_quantized.onnx"), {
    executionProviders: ["wasm"],
  });

  async function embed(texts: string[]): Promise<number[][]> {
    const enc = tokenizer(texts, { padding: true, truncation: true });
    const feeds: Record<string, ort.Tensor> = {};
    for (const name of session.inputNames) {
      const t = enc[name as "input_ids" | "attention_mask"];
      feeds[name] = new ort.Tensor("int64", BigInt64Array.from(t.data as ArrayLike<bigint>), t.dims);
    }
    const out = await session.run(feeds);
    const res = out.text_embeds ?? out[session.outputNames[0]];
    const dim = res.dims[1];
    const data = res.data as Float32Array;
    return texts.map((_, i) => normalize(data.slice(i * dim, (i + 1) * dim)));
  }

  const categories: Record<string, number[]> = {};
  for (const [slug, phrases] of Object.entries(CATEGORIES)) categories[slug] = mean(await embed(phrases));
  const out = {
    model: "fashion-clip-vit-b32-q8",
    categories,
    notClothing: await embed(NOT_CLOTHING),
    blocked: await embed(BLOCKED),
  };
  const file = path.resolve("src/lib/visual/prompts.json");
  writeFileSync(file, JSON.stringify(out));
  console.log(`Escrito ${file}: ${Object.keys(categories).length} categorías, ${out.notClothing.length} no-ropa, ${out.blocked.length} bloqueadas.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
