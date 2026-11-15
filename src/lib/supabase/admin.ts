import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Cliente con service role. SOLO servidor (route handlers, `after()`, cron): salta RLS.
// Hoy lo usa la búsqueda por foto (spec 005) para la RPC search_by_embedding, el registro sin
// imagen en photo_searches y la escritura de garment_embeddings. Nunca importarlo desde el cliente
// ni exponer la clave con NEXT_PUBLIC_ (constitución, principio III).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
