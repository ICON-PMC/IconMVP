import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Intercambia el code de OAuth (Google) por una sesión.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("No se pudo iniciar sesión con el proveedor")}`,
  );
}
