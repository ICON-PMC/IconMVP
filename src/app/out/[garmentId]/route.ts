import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

const SOURCES: Database["public"]["Enums"]["click_source"][] = [
  "feed",
  "post",
  "garment",
  "brand_profile",
];

// Redirección de salida a la tienda de la marca, registrando el clic (tracking día 1).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ garmentId: string }> },
) {
  const { garmentId } = await params;
  const url = new URL(req.url);
  const postId = url.searchParams.get("post");
  const sourceParam = url.searchParams.get("source") ?? "post";
  const source = (
    SOURCES.includes(sourceParam as never) ? sourceParam : "post"
  ) as Database["public"]["Enums"]["click_source"];

  const supabase = await createClient();

  const { data: garment } = await supabase
    .from("garments")
    .select("id, brand_id, product_url")
    .eq("id", garmentId)
    .maybeSingle();

  if (!garment) return NextResponse.redirect(new URL("/feed", req.url));

  // Atribuir al usuario si hay sesión (si no, queda anónimo).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let userId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();
    userId = profile?.id ?? null;
  }

  await supabase.from("outbound_clicks").insert({
    garment_id: garment.id,
    brand_id: garment.brand_id,
    post_id: postId,
    user_id: userId,
    source,
  });

  const dest = garment.product_url ?? new URL("/feed", req.url).toString();
  return NextResponse.redirect(dest);
}
