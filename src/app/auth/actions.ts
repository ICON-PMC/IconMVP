"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/auth-errors";

// Destino tras iniciar sesión: solo rutas internas ("/algo", nunca "//dominio" ni URLs absolutas),
// para no convertir el login en un redirector abierto.
function safeNext(raw: FormDataEntryValue | null): string | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const keep = next ? `&next=${encodeURIComponent(next)}` : "";
    redirect(`/login?error=${encodeURIComponent(authErrorMessage(error))}${keep}`);
  }

  revalidatePath("/", "layout");
  // Vuelve a donde estaba (barra de navegación, "Guardar" sin sesión…) o al inicio.
  redirect(next ?? "/");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "");
  const isBrand = formData.get("account_type") === "brand";
  // Spec 010: la marca mencionada desde la que llegó ("¿Es tu marca?") se conserva hasta el onboarding.
  const stubRaw = String(formData.get("stub") ?? "");
  const stub = isBrand && /^[0-9a-f-]{36}$/i.test(stubRaw) ? stubRaw : null;
  const signupPath = isBrand ? `/signup?tipo=marca${stub ? `&stub=${stub}` : ""}` : "/signup";
  const brandOnboarding = `/onboarding/marca${stub ? `?stub=${stub}` : ""}`;

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  const sep = signupPath.includes("?") ? "&" : "?";
  // "Ya registrado": por error (confirmación apagada, como en la nube) o como usuario sin
  // identidades (confirmación activa, para no revelar qué correos existen).
  const alreadyRegistered =
    (error && (error.code === "user_already_exists" || error.code === "email_exists" ||
      /already (been )?registered|already exists/i.test(error.message))) ||
    (!error && data.user && data.user.identities?.length === 0);
  if (alreadyRegistered) {
    // Si la contraseña coincide es su propia cuenta: la que acaba de crear un envío duplicado
    // (doble toque) o una que ya tenía. Entra en vez de ver "ya registrado".
    const { data: signedIn } = await supabase.auth.signInWithPassword({ email, password });
    if (!signedIn.session)
      redirect(`${signupPath}${sep}error=${encodeURIComponent("Este correo ya está registrado. Inicia sesión.")}`);
    revalidatePath("/", "layout");
    redirect(isBrand ? brandOnboarding : "/onboarding");
  }
  if (error) redirect(`${signupPath}${sep}error=${encodeURIComponent(authErrorMessage(error))}`);
  // Sin sesión = hay que confirmar el correo antes de entrar al onboarding.
  if (!data.session)
    redirect(`/login?aviso=${encodeURIComponent("Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión.")}`);

  revalidatePath("/", "layout");
  redirect(isBrand ? brandOnboarding : "/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
