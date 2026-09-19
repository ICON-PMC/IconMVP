// Integración con Instagram: "API de Instagram con inicio de sesión de Instagram"
// (Instagram Platform sobre Graph API). Meta retiró la Instagram Basic Display API a
// finales de 2024 — este es el reemplazo, y solo funciona con cuentas de Instagram
// profesionales (Business o Creator), no con cuentas personales.
//
// Variables de entorno requeridas (ver .env.example para dónde sacarlas en Meta
// Developers): INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, NEXT_PUBLIC_APP_URL.
//
// Referencia: https://developers.facebook.com/docs/instagram-platform

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;
const SCOPES = "instagram_business_basic"; // solo lectura de perfil + media; no publicamos.

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export function getRedirectUri(): string {
  return `${env("NEXT_PUBLIC_APP_URL").replace(/\/$/, "")}/api/instagram/callback`;
}

// Construye una URL absoluta a partir de NEXT_PUBLIC_APP_URL, no de request.url. Detrás de
// un túnel (ngrok/cloudflared) Next.js no siempre reconstruye request.url con el host
// público correcto (puede resolver al bind local, localhost:3000, sin TLS) — usar
// NEXT_PUBLIC_APP_URL como única fuente de verdad evita ese problema en las rutas de
// Instagram, que además DEBE coincidir exacto con el redirect URI registrado en Meta.
export function absoluteUrl(pathAndQuery: string): URL {
  return new URL(pathAndQuery, env("NEXT_PUBLIC_APP_URL"));
}

// URL de autorización. Redirige aquí desde un <a>/<Link> normal: no necesita el secret,
// solo el App ID (público) — por eso no hace falta un route handler para construirla.
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("INSTAGRAM_APP_ID"),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

type ShortLivedTokenResponse = { access_token: string; user_id: string; permissions?: string[] };
type LongLivedTokenResponse = { access_token: string; token_type: string; expires_in: number };
export type InstagramProfile = { id: string; username: string; account_type: string };
export type InstagramMedia = {
  id: string;
  caption: string | null;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string;
};

async function graphFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message ?? `Instagram API respondió ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

// Paso 1: intercambia el `code` de la redirección por un token de corta duración (~1h).
export async function exchangeCodeForShortLivedToken(
  code: string,
): Promise<ShortLivedTokenResponse> {
  const form = new URLSearchParams({
    client_id: env("INSTAGRAM_APP_ID"),
    client_secret: env("INSTAGRAM_APP_SECRET"),
    grant_type: "authorization_code",
    redirect_uri: getRedirectUri(),
    code,
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(body?.error_message ?? `Instagram OAuth respondió ${res.status}`);
  }
  return body as ShortLivedTokenResponse;
}

// Paso 2: cambia el token corto por uno de larga duración (~60 días).
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<LongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: env("INSTAGRAM_APP_SECRET"),
    access_token: shortLivedToken,
  });
  return graphFetch<LongLivedTokenResponse>(
    `https://graph.instagram.com/access_token?${params}`,
  );
}

// Refresca un token de larga duración antes de que expire (debe tener al menos 24h de
// vida). Extiende otros ~60 días. Sin esto, la conexión de la marca se rompe en silencio
// dos meses después de conectarla.
export async function refreshLongLivedToken(
  currentToken: string,
): Promise<LongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: currentToken,
  });
  return graphFetch<LongLivedTokenResponse>(
    `https://graph.instagram.com/refresh_access_token?${params}`,
  );
}

export async function fetchProfile(accessToken: string): Promise<InstagramProfile> {
  const params = new URLSearchParams({
    fields: "id,username,account_type",
    access_token: accessToken,
  });
  return graphFetch<InstagramProfile>(`${GRAPH_BASE}/me?${params}`);
}

// Trae la media reciente de la cuenta (paginada). Para MVP no seguimos `paging.next`
// automáticamente — se trae una página (hasta `limit`) y basta para elegir qué importar.
// Nota: un CAROUSEL_ALBUM solo trae la foto de portada en media_url; para traer cada foto
// del carrusel por separado habría que llamar a /{media-id}/children — se deja fuera del
// MVP a propósito (importa 1 foto por post seleccionado, no el álbum completo).
export async function fetchRecentMedia(
  accessToken: string,
  limit = 25,
): Promise<InstagramMedia[]> {
  const params = new URLSearchParams({
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
    limit: String(limit),
    access_token: accessToken,
  });
  const body = await graphFetch<{ data: InstagramMedia[] }>(`${GRAPH_BASE}/me/media?${params}`);
  // Solo fotos: los videos/reels no aplican al catálogo de outfits.
  return body.data.filter((m) => m.media_type !== "VIDEO");
}
