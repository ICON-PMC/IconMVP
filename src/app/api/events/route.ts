import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Recibe lotes de señales (spec 003, contracts §1) y los pasa a `log_events`, que fija el usuario de
// la sesión. Nunca usa service_role. Responde 204 aunque la base descarte duplicados.

const MAX_BYTES = 16 * 1024;
const LIMIT_PER_MIN = 60;
const UUID = /^[0-9a-f-]{36}$/i;
const SURFACES = new Set(["feed", "following", "search", "profile", "brand_page", "similar", "photo_search", "detail"]);
const ITEMS = new Set(["garment", "post", "brand"]);
const TABS = new Set(["garments", "posts", "brands", "feed"]);

// Límite por actor en memoria de la instancia (suficiente a esta escala).
const hits = new Map<string, { n: number; at: number }>();
function limited(key: string): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.at > 60_000) {
    hits.set(key, { n: 1, at: now });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  h.n += 1;
  return h.n > LIMIT_PER_MIN;
}

type Body = {
  anonKey?: unknown;
  impressions?: unknown;
  views?: unknown;
  searches?: unknown;
};

const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return new NextResponse(null, { status: 400 });
  let body: Body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const impressions = arr(body.impressions)
    .map(obj)
    .filter((i) => ITEMS.has(String(i.itemKind)) && UUID.test(String(i.itemId)) && SURFACES.has(String(i.surface)))
    .map((i) => ({
      itemKind: String(i.itemKind),
      itemId: String(i.itemId),
      surface: String(i.surface),
      position: Number.isFinite(Number(i.position)) ? Math.trunc(Number(i.position)) : null,
      sort: typeof i.sort === "string" ? i.sort.slice(0, 20) : null,
      personalized: i.personalized === true,
    }));
  const views = arr(body.views)
    .map(obj)
    .filter((v) => ITEMS.has(String(v.itemKind)) && UUID.test(String(v.itemId)))
    .map((v) => ({ itemKind: String(v.itemKind), itemId: String(v.itemId) }));
  const searches = arr(body.searches)
    .map(obj)
    .filter((s) => TABS.has(String(s.tab)) && Number.isFinite(Number(s.results)))
    .map((s) => ({
      q: typeof s.q === "string" ? s.q.slice(0, 200) : null,
      filters: JSON.parse(JSON.stringify(obj(s.filters))) as { [k: string]: string[] | number },
      tab: String(s.tab),
      sort: typeof s.sort === "string" ? s.sort.slice(0, 20) : null,
      results: Math.max(0, Math.trunc(Number(s.results))),
    }));
  if (impressions.length + views.length + searches.length === 0) return new NextResponse(null, { status: 204 });
  if (impressions.length + views.length + searches.length > 50) return new NextResponse(null, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const anonKey = typeof body.anonKey === "string" && /^[a-z0-9]{16,32}$/.test(body.anonKey) ? body.anonKey : null;
  const actor = auth.user?.id ?? anonKey;
  if (!actor) return new NextResponse(null, { status: 400 });
  if (limited(actor)) return new NextResponse(null, { status: 429 });

  const { error } = await supabase.rpc("log_events", {
    p: { anon_key: auth.user ? null : anonKey, impressions, views, searches },
  });
  if (error) console.error("[events] log_events falló:", error.message);
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
