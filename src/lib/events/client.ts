"use client";

// Cola de señales del navegador (spec 003, contracts §2). Envía cada 5 s, al llegar a 50 y al ocultar
// la pestaña (sendBeacon). Sin sesión usa una clave aleatoria por pestaña (sessionStorage): no hay
// identificadores persistentes para anónimos. Nunca lanza.

export type Surface = "feed" | "following" | "search" | "profile" | "brand_page" | "similar" | "photo_search" | "detail";
export type ItemKind = "garment" | "post" | "brand";
export type ImpressionEvent = { itemKind: ItemKind; itemId: string; surface: Surface; position: number; sort?: string | null; personalized?: boolean };
export type ViewEvent = { itemKind: ItemKind; itemId: string };
export type SearchEvent = { q: string | null; filters: Record<string, string[] | number>; tab: "garments" | "posts" | "brands" | "feed"; sort: string; results: number };

const queue: { impressions: ImpressionEvent[]; views: ViewEvent[]; searches: SearchEvent[] } = { impressions: [], views: [], searches: [] };
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function anonKey(): string | null {
  try {
    let k = sessionStorage.getItem("icon.anon.v1");
    if (!k) {
      const bytes = crypto.getRandomValues(new Uint8Array(12));
      k = Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-8);
      k = k.slice(0, 24);
      sessionStorage.setItem("icon.anon.v1", k);
    }
    return k;
  } catch {
    return null;
  }
}

function size() {
  return queue.impressions.length + queue.views.length + queue.searches.length;
}

function flush(beacon = false) {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!size()) return;
  const batch = { anonKey: anonKey(), impressions: queue.impressions.splice(0, 50), views: [] as ViewEvent[], searches: [] as SearchEvent[] };
  batch.views = queue.views.splice(0, 50 - batch.impressions.length);
  batch.searches = queue.searches.splice(0, 50 - batch.impressions.length - batch.views.length);
  const body = JSON.stringify(batch);
  try {
    if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    else void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    /* se descarta */
  }
  if (size()) schedule(0);
}

function schedule(ms = 5000) {
  if (typeof window === "undefined") return;
  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush(true);
    });
    // Recarga o salida completa de la página: se envía lo pendiente.
    window.addEventListener("pagehide", () => flush(true));
  }
  if (size() >= 50) return flush();
  if (!timer) timer = setTimeout(() => flush(), ms);
}

export function trackImpression(e: ImpressionEvent) {
  queue.impressions.push(e);
  schedule();
}
export function trackView(e: ViewEvent) {
  queue.views.push(e);
  schedule(500);
}
export function trackSearch(e: SearchEvent) {
  queue.searches.push(e);
  schedule(1000);
}
