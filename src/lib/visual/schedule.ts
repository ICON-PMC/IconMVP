// Programa el cálculo de huellas visuales DESPUÉS de responder (spec 005, FR-016).
// Los triggers de la base ya dejaron las prendas en `pending`; esto solo adelanta el trabajo
// para que una prenda nueva sea buscable en segundos. Si falla, el cron la retoma.
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPending } from "./index-garments";

export function scheduleEmbeddings(garmentIds?: string[]) {
  if (!process.env.VISUAL_MODEL_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  after(async () => {
    try {
      await processPending(createAdminClient(), { limit: 25, garmentIds });
    } catch (e) {
      console.error("[visual] indexación en segundo plano falló:", e);
    }
  });
}
