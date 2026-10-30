// Peticiones respetuosas a la tienda de una marca: identificadas, con espera, respetando robots.txt
// y con una guarda contra peticiones a redes privadas (SSRF). Compartido por el CLI y el panel.
// Módulo sin dependencias de Next.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class BloqueadoError extends Error {}
// Error de validación legible para el staff (URL no permitida, tienda no pública, etc.).
export class CatalogInputError extends Error {}

export function buildUserAgent(contact?: string | null): string {
  return `IconCatalogBot/1.0 (+${contact ?? "equipo Icon"}; importación con consentimiento de la marca)`;
}

// ───────────────────────────── guarda SSRF ─────────────────────────────
function ipv4Private(a: number, b: number): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast y reservadas
  );
}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return ipv4Private(a, b);
  }
  const v6 = ip.toLowerCase();
  // IPv4 incrustada: ::ffff:a.b.c.d (con puntos) o ::ffff:hhhh:hhhh (así la normaliza new URL), y la forma
  // compatible ::hhhh:hhhh. Se evalúa como la IPv4 que lleva dentro.
  const dotted = v6.match(/^::ffff:(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) return ipv4Private(Number(dotted[1]), Number(dotted[2]));
  const hex = v6.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) return ipv4Private(parseInt(hex[1], 16) >> 8, parseInt(hex[1], 16) & 255);
  // NAT64 (64:ff9b::/96) traduce a IPv4 arbitrarias: se descarta por prudencia.
  if (v6.startsWith("64:ff9b:")) return true;
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || // fe80::/10
    v6.startsWith("fc") || v6.startsWith("fd") // fc00::/7
  );
}

// Valida que una URL sea http/https hacia un host público. Resuelve el DNS y rechaza el host si
// CUALQUIER dirección es privada, loopback o link-local. Lanza CatalogInputError en español.
export async function assertPublicHttpUrl(raw: string | URL): Promise<URL> {
  let u: URL;
  try {
    u = raw instanceof URL ? raw : new URL(raw);
  } catch {
    throw new CatalogInputError(`La dirección no es válida: ${String(raw)}`);
  }
  // Solo para probar contra una tienda falsa en la propia máquina. NODE_ENV es siempre "production" en
  // `next build`/`next start` (Vercel), así que esto no puede activarse allí aunque la variable exista.
  if (process.env.NODE_ENV === "development" && process.env.CATALOG_ALLOW_PRIVATE_HOSTS === "1") return u;
  if (u.protocol !== "https:" && u.protocol !== "http:")
    throw new CatalogInputError("La dirección debe empezar por http:// o https://.");
  if (u.username || u.password) throw new CatalogInputError("La dirección no puede incluir usuario ni contraseña.");
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    (!host.includes(".") && isIP(host) === 0)
  )
    throw new CatalogInputError("La dirección apunta a una red privada y no se puede leer.");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new CatalogInputError("La dirección apunta a una red privada y no se puede leer.");
    return u;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new CatalogInputError(`No se pudo encontrar el dominio ${host}. Revisa que esté bien escrito.`);
  }
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address)))
    throw new CatalogInputError("La dirección apunta a una red privada y no se puede leer.");
  return u;
}

// Las fotos solo se descargan del host de la tienda o de la CDN de Shopify.
export function isAllowedPhotoHost(photoUrl: string, shopOrigin: string | null): boolean {
  let host: string;
  try {
    host = new URL(photoUrl.startsWith("//") ? `https:${photoUrl}` : photoUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === "cdn.shopify.com" || host.endsWith(".myshopify.com")) return true;
  if (!shopOrigin) return false;
  try {
    const shop = new URL(shopOrigin).hostname.toLowerCase().replace(/^www\./, "");
    return host.replace(/^www\./, "") === shop || host.endsWith(`.${shop}`);
  } catch {
    return false;
  }
}

// ───────────────────────────── petición educada ─────────────────────────────
export type FetchCtx = {
  userAgent: string;
  // true (panel): valida cada URL y cada redirección con assertPublicHttpUrl. El CLI corre en el
  // equipo de quien lo ejecuta y no lo necesita.
  guard?: boolean;
  tries?: number;
  timeoutMs?: number;
  accept?: string;
  // Aviso de espera (el CLI lo imprime; el panel lo recolecta).
  onWait?: (message: string) => void;
};

const MAX_REDIRECTS = 5;

// Identificada, con espera y reintentos limitados si la tienda pide frenar. Si sigue pidiendo frenar,
// se detiene (nunca se intenta esquivar el límite). Las redirecciones se siguen a mano.
export async function politeFetch(url: string, ctx: FetchCtx): Promise<Response> {
  const tries = ctx.tries ?? 4;
  let current = url;
  for (let hops = 0; ; ) {
    if (ctx.guard) await assertPublicHttpUrl(current);
    let res: Response | null = null;
    for (let attempt = 0; ; attempt++) {
      res = await fetch(current, {
        headers: { "User-Agent": ctx.userAgent, Accept: ctx.accept ?? "application/json,text/plain,*/*" },
        signal: AbortSignal.timeout(ctx.timeoutMs ?? 30_000),
        redirect: "manual",
      });
      if (res.status !== 429 && res.status !== 503) break;
      if (attempt >= tries) throw new BloqueadoError(`${res.status} en ${new URL(current).host}`);
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Math.min(retryAfter > 0 ? retryAfter * 1000 : 5000 * 2 ** attempt, 60_000);
      ctx.onWait?.(`La tienda pidió esperar (${res.status}). Reintento en ${Math.round(waitMs / 1000)} s…`);
      await res.body?.cancel();
      await sleep(waitMs);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (++hops > MAX_REDIRECTS) throw new CatalogInputError("La tienda redirige demasiadas veces.");
      const next = new URL(res.headers.get("location")!, current).toString();
      await res.body?.cancel();
      current = next;
      continue;
    }
    return res;
  }
}

// ───────────────────────────── robots.txt ─────────────────────────────
type RobotsGroup = { agents: string[]; rules: { allow: boolean; pattern: string }[] };

export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let cur: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && cur) {
      lastWasAgent = false;
      if (val) cur.rules.push({ allow: key === "allow", pattern: val });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

export function robotsAllows(groups: RobotsGroup[], path: string): boolean {
  const group =
    groups.find((g) => g.agents.includes("iconcatalogbot")) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  let best: { allow: boolean; len: number } | null = null;
  for (const r of group.rules) {
    const re = new RegExp(
      "^" + r.pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"),
    );
    if (re.test(path) && (!best || r.pattern.length > best.len || (r.pattern.length === best.len && r.allow)))
      best = { allow: r.allow, len: r.pattern.length };
  }
  return best ? best.allow : true;
}
