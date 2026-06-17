import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Convención de Next 16 (reemplaza a middleware.ts): refresca la sesión de Supabase.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Todas las rutas excepto estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
