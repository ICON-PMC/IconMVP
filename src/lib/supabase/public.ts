import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente anónimo, sin cookies ni sesión (spec 006). Solo ve lo que RLS permite a `anon`: contenido
 * publicado. Es el único cliente que se puede usar dentro de una caché compartida entre visitantes:
 * nada leído con la sesión de una persona entra en esa caché.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
