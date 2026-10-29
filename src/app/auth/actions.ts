"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/auth-errors";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(authErrorMessage(error))}`);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "");
  const isBrand = formData.get("account_type") === "brand";
  const signupPath = isBrand ? "/signup?tipo=marca" : "/signup";

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
    redirect(isBrand ? "/onboarding/marca" : "/onboarding");
  }
  if (error) redirect(`${signupPath}${sep}error=${encodeURIComponent(authErrorMessage(error))}`);
  // Sin sesión = hay que confirmar el correo antes de entrar al onboarding.
  if (!data.session)
    redirect(`/login?aviso=${encodeURIComponent("Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión.")}`);

  revalidatePath("/", "layout");
  redirect(isBrand ? "/onboarding/marca" : "/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
