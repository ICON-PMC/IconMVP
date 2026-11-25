import { createClient } from "@/lib/supabase/server";

// Clics de salida a las tiendas por marca y por prenda (panel del equipo). Solo staff puede leer
// `outbound_clicks`. Sin migración: se agrega en el servidor.
//
// Robots: hasta noviembre de 2026 había ráfagas de clics anónimos (hasta 63 prendas distintas en un
// minuto) de robots que seguían los enlaces /out. Una persona no abre 6 tiendas distintas en un
// minuto: un clic anónimo cuyo minuto tiene 6 o más prendas distintas (entre clics anónimos) se
// cuenta como automático y se excluye del estimado. Desde este cambio, /out tampoco registra
// agentes que se identifican como robots.
const BURST_GARMENTS = 6;
const PAGE = 1000;
const MAX_ROWS = 50_000;

export type ClickPeriod = "7" | "30" | "90" | "todo";
export const CLICK_PERIODS: { id: ClickPeriod; label: string }[] = [
  { id: "7", label: "7 días" },
  { id: "30", label: "30 días" },
  { id: "90", label: "90 días" },
  { id: "todo", label: "Todo" },
];

type Click = { created_at: string; garment_id: string | null; brand_id: string | null; user_id: string | null };

export type BrandClickRow = { brandId: string; name: string; slug: string; clicks: number; raw: number };
export type GarmentClickRow = { garmentId: string; title: string; clicks: number; raw: number; share: number; lastAt: string | null };
export type ClickStats = {
  period: ClickPeriod;
  totals: { clicks: number; raw: number; automated: number };
  brands: BrandClickRow[];
  /** Solo si se eligió una marca. */
  brand: { id: string; name: string; slug: string; clicks: number; raw: number; garments: GarmentClickRow[]; noClicks: number } | null;
};

function sinceIso(period: ClickPeriod, now: number): string | null {
  return period === "todo" ? null : new Date(now - Number(period) * 864e5).toISOString();
}

export async function loadClickStats(period: ClickPeriod, brandSlug: string | null, now: number): Promise<ClickStats> {
  const supabase = await createClient();
  const since = sinceIso(period, now);

  const clicks: Click[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    let q = supabase.from("outbound_clicks").select("created_at, garment_id, brand_id, user_id").order("created_at").range(from, from + PAGE - 1);
    if (since) q = q.gte("created_at", since);
    const { data, error } = await q;
    if (error) {
      console.error("[clicks] lectura falló:", error.message);
      break;
    }
    clicks.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  // Minutos con ráfaga de clics anónimos a muchas prendas distintas.
  const perMinute = new Map<string, Set<string>>();
  for (const c of clicks) {
    if (c.user_id || !c.garment_id) continue;
    const m = c.created_at.slice(0, 16);
    (perMinute.get(m) ?? perMinute.set(m, new Set()).get(m)!).add(c.garment_id);
  }
  const automated = (c: Click) => !c.user_id && (perMinute.get(c.created_at.slice(0, 16))?.size ?? 0) >= BURST_GARMENTS;

  const { data: brandRows } = await supabase.from("brands").select("id, name, slug").order("name");
  const byBrand = new Map<string, { clicks: number; raw: number }>();
  let human = 0;
  for (const c of clicks) {
    const auto = automated(c);
    if (!auto) human++;
    if (!c.brand_id) continue;
    const b = byBrand.get(c.brand_id) ?? { clicks: 0, raw: 0 };
    b.raw++;
    if (!auto) b.clicks++;
    byBrand.set(c.brand_id, b);
  }
  const brands: BrandClickRow[] = (brandRows ?? [])
    .map((b) => ({ brandId: b.id, name: b.name, slug: b.slug, ...(byBrand.get(b.id) ?? { clicks: 0, raw: 0 }) }))
    .filter((b) => b.raw > 0)
    .sort((a, b) => b.clicks - a.clicks || b.raw - a.raw);

  let brand: ClickStats["brand"] = null;
  const chosen = brandSlug ? (brandRows ?? []).find((b) => b.slug === brandSlug) : null;
  if (chosen) {
    const { data: garments } = await supabase.from("garments").select("id, title, status").eq("brand_id", chosen.id);
    const per = new Map<string, { clicks: number; raw: number; lastAt: string | null }>();
    for (const c of clicks) {
      if (c.brand_id !== chosen.id || !c.garment_id) continue;
      const g = per.get(c.garment_id) ?? { clicks: 0, raw: 0, lastAt: null };
      g.raw++;
      if (!automated(c)) {
        g.clicks++;
        g.lastAt = c.created_at;
      }
      per.set(c.garment_id, g);
    }
    const totals = byBrand.get(chosen.id) ?? { clicks: 0, raw: 0 };
    const rows: GarmentClickRow[] = (garments ?? [])
      .map((g) => {
        const s = per.get(g.id) ?? { clicks: 0, raw: 0, lastAt: null };
        return { garmentId: g.id, title: g.title, ...s, share: totals.clicks ? s.clicks / totals.clicks : 0 };
      })
      .filter((g) => g.clicks > 0)
      .sort((a, b) => b.clicks - a.clicks);
    const published = (garments ?? []).filter((g) => g.status === "published").length;
    brand = {
      id: chosen.id,
      name: chosen.name,
      slug: chosen.slug,
      ...totals,
      garments: rows,
      noClicks: Math.max(0, published - rows.length),
    };
  }

  return { period, totals: { clicks: human, raw: clicks.length, automated: clicks.length - human }, brands, brand };
}

export function parseClickPeriod(v: string | undefined): ClickPeriod {
  return v === "7" || v === "90" || v === "todo" ? v : "30";
}
