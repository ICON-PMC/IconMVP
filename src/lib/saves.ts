import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

// Conjuntos de ids guardados por la usuaria actual (vacíos si es anónima).
export async function getMySavedIds(): Promise<{
  posts: Set<string>;
  garments: Set<string>;
}> {
  const session = await getCurrentUser();
  if (!session?.profile) return { posts: new Set(), garments: new Set() };

  const supabase = await createClient();
  const userId = session.profile.id;
  const [sp, sg] = await Promise.all([
    supabase.from("saved_posts").select("post_id").eq("user_id", userId),
    supabase.from("saved_garments").select("garment_id").eq("user_id", userId),
  ]);

  return {
    posts: new Set((sp.data ?? []).map((r) => r.post_id)),
    garments: new Set((sg.data ?? []).map((r) => r.garment_id)),
  };
}
