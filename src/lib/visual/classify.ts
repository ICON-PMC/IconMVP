// Clasificación de la foto buscada con vectores de texto precalculados (spec 005, research R4):
// categoría probable (FR-006), "no es ropa" (US2 AS4) y contenido no permitido (FR-015).
import prompts from "./prompts.json";
import { cosine } from "./embed";
import { BLOCK_MARGIN, NOT_CLOTHING_MARGIN } from "./thresholds";

type Vec = ArrayLike<number>;
const CATEGORY_ENTRIES = Object.entries(prompts.categories as Record<string, number[]>);

const maxSim = (v: Vec, list: number[][]) => Math.max(...list.map((p) => cosine(v, p)));

/** Similitud con cada categoría, de mayor a menor. */
export function rankCategories(v: Vec): { slug: string; sim: number }[] {
  return CATEGORY_ENTRIES.map(([slug, p]) => ({ slug, sim: cosine(v, p) })).sort((a, b) => b.sim - a.sim);
}

/**
 * Categoría detectada: la frase más parecida, confirmada por voto de los vecinos del catálogo.
 * Si 4+ de los 10 vecinos comparten categoría y no coincide con el texto, gana el voto (el
 * catálogo conoce mejor cómo se ven *nuestras* prendas que una frase genérica).
 */
export function detectCategory(v: Vec, neighborCategories: (string | null | undefined)[] = []): string {
  const byText = rankCategories(v)[0].slug;
  const votes = new Map<string, number>();
  for (const c of neighborCategories.slice(0, 10)) if (c) votes.set(c, (votes.get(c) ?? 0) + 1);
  const [top] = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (top && top[0] !== byText && top[1] >= 4 && (votes.get(byText) ?? 0) < 2) return top[0];
  return byText;
}

/** La foto se parece más a "no es ropa" que a cualquier prenda. */
export function looksLikeNoClothing(v: Vec): boolean {
  const clothing = rankCategories(v)[0].sim;
  return maxSim(v, prompts.notClothing) > clothing + NOT_CLOTHING_MARGIN;
}

/** Contenido no permitido: se parece más a las frases bloqueadas que a cualquier prenda. */
export function isBlocked(v: Vec): boolean {
  const clothing = rankCategories(v)[0].sim;
  return maxSim(v, prompts.blocked) > clothing + BLOCK_MARGIN;
}
