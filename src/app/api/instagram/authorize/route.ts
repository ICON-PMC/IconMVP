import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildAuthorizeUrl, absoluteUrl } from "@/lib/instagram";

export const STATE_COOKIE = "ig_oauth_state";

// Arranca el login con Instagram. Ruta aparte (en vez de construir el link directo en la
// página) solo porque necesita ESCRIBIR una cookie (el nonce anti-CSRF de `state`), y en
// Next eso requiere un route handler o server action, no un <a href> plano en una página.
export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.redirect(absoluteUrl("/login?next=/marca/panel"));
  }

  const state = crypto.randomUUID();
  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(state);
  } catch (e) {
    console.error("[instagram/authorize] configuración incompleta:", e);
    const msg =
      e instanceof Error
        ? e.message
        : "Falta configurar la integración con Instagram.";
    return NextResponse.redirect(absoluteUrl(`/marca/panel?error=${encodeURIComponent(msg)}`));
  }

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
