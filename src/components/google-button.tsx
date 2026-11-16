"use client";

import { Button } from "@/components/ui/button";
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
    <Button type="button" variant="secondary" size="lg" onClick={handleClick} className="w-full">
      Continuar con Google
    </Button>
  );
}
