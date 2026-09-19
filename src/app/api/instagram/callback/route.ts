import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyBrand } from "@/lib/auth";
import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchProfile,
  absoluteUrl,
} from "@/lib/instagram";
import { STATE_COOKIE } from "@/app/api/instagram/authorize/route";

function fail(message: string) {
  return NextResponse.redirect(absoluteUrl(`/marca/panel?error=${encodeURIComponent(message)}`));
}

// Convierte "Marca de Prueba IG" en "marca-de-prueba-ig"; si ya existe le suma -2, -3...
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "marca";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  const session = await getCurrentUser();
  if (!session?.profile) {
    return NextResponse.redirect(absoluteUrl("/login?next=/marca/panel"));
  }

  if (oauthError) return fail(`Instagram: ${oauthError}`);
  if (!code) return fail("Instagram no envió un código de autorización.");
  if (!state || !expectedState || state !== expectedState) {
    return fail("La sesión de autorización expiró o no es válida. Intenta de nuevo.");
  }

  let profile;
  try {
    const short = await exchangeCodeForShortLivedToken(code);
    const long = await exchangeForLongLivedToken(short.access_token);
    profile = { ...(await fetchProfile(long.access_token)), token: long };
  } catch (e) {
    console.error("[instagram/callback] intercambio de token falló:", e);
    return fail(e instanceof Error ? e.message : "No se pudo conectar con Instagram.");
  }

  if (profile.account_type !== "BUSINESS" && profile.account_type !== "MEDIA_CREATOR") {
    return fail(
      "Esa cuenta de Instagram es personal. Cámbiala a cuenta profesional (Business o Creator) e intenta de nuevo.",
    );
  }

  const supabase = await createClient();

  let brand = await getMyBrand();
  if (!brand) {
    const baseSlug = slugify(profile.username);
    let slug = baseSlug;
    let created: { id: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const { data, error } = await supabase
        .from("brands")
        .insert({
          name: profile.username,
          slug,
          owner_user_id: session.profile.id,
          is_active: false,
        })
        .select("id")
        .single();
      if (data) {
        created = data;
      } else if (error?.code === "23505") {
        slug = `${baseSlug}-${attempt + 2}`;
      } else {
        console.error("[instagram/callback] crear marca falló:", error?.message);
        return fail(error?.message ?? "No se pudo crear la marca.");
      }
    }
    if (!created) return fail("No se pudo generar un identificador único para la marca.");
    brand = await getMyBrand();
  }
  if (!brand) return fail("No se pudo crear ni encontrar la marca.");

  const { error: connErr } = await supabase.from("brand_instagram_connections").upsert(
    {
      brand_id: brand.id,
      ig_user_id: profile.id,
      username: profile.username,
      account_type: profile.account_type,
      access_token: profile.token.access_token,
      token_expires_at: new Date(Date.now() + profile.token.expires_in * 1000).toISOString(),
      connected_by_user_id: session.profile.id,
    },
    { onConflict: "brand_id" },
  );
  if (connErr) {
    const msg =
      connErr.code === "23505"
        ? "Esa cuenta de Instagram ya está conectada a otra marca en Icon."
        : connErr.message;
    console.error("[instagram/callback] guardar conexión falló:", connErr.message);
    return fail(msg);
  }

  if (session.profile.role === "user") {
    await supabase.from("users").update({ role: "brand" }).eq("id", session.profile.id);
  }

  return NextResponse.redirect(absoluteUrl("/marca/panel?ok=conectado"));
}
