// GET /api/visual/warmup — carga el modelo en la instancia antes de que llegue la foto (spec 005,
// research R1). La llama el botón de cámara al abrirse.
import { getVisualSession } from "@/lib/visual/model";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    await getVisualSession();
  } catch (e) {
    console.error("[visual/warmup] no se pudo cargar el modelo:", e);
  }
  return new Response(null, { status: 204 });
}
