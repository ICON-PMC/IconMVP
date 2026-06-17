"use client";

import { createClient } from "@/lib/supabase/client";

// Botón de Google. Requiere configurar el proveedor en supabase/config.toml + credenciales
// (ver .env.example). Sin eso, mostrará un error del proveedor.
export function GoogleButton() {
  async function handleClick() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="glass-input flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-ink hover:bg-white/70"
    >
      Continuar con Google
    </button>
  );
}
