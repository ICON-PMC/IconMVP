import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type SuggestionChip = {
  param: "city" | "style" | "occasion";
  value: string;
  label: string;
};

const MAX_CHIPS = 6;

// Chips de aplicación rápida arriba de la grilla (grupo 6). Con sesión y onboarding
// completo: ciudad de origen + estilos elegidos. Sin sesión, u onboarding omitido
// (sin ciudad ni estilos guardados): las etiquetas de ocasión/estilo más frecuentes
// en el contenido publicado. Nunca cambia el ranking, solo aplica/quita un filtro.
export async function getSuggestionChips(): Promise<SuggestionChip[]> {
  const session = await getCurrentUser();
  const supabase = await createClient();

  if (session?.profile) {
    const chips: SuggestionChip[] = [];

    if (session.profile.home_city_id) {
      const { data: city } = await supabase
        .from("cities")
        .select("slug, name")
        .eq("id", session.profile.home_city_id)
        .maybeSingle();
      if (city) chips.push({ param: "city", value: city.slug, label: city.name });
    }

    const { data: prefRows } = await supabase
      .from("user_preferences")
      .select("tag_id")
      .eq("user_id", session.profile.id);
    const tagIds = (prefRows ?? []).map((r) => r.tag_id);
    if (tagIds.length) {
      const { data: tags } = await supabase
        .from("tags")
        .select("slug, name, type")
        .in("id", tagIds);
      for (const tag of tags ?? []) {
        if (tag.type === "style" || tag.type === "occasion") {
          chips.push({ param: tag.type, value: tag.slug, label: tag.name });
        }
      }
    }

    if (chips.length > 0) return chips.slice(0, MAX_CHIPS);
  }

  const { data, error } = await supabase.rpc("popular_content_tags", { p_limit: MAX_CHIPS });
  if (error || !data) return [];
  return data
    .filter((t): t is { slug: string; name: string; type: "style" | "occasion" } =>
      t.type === "style" || t.type === "occasion",
    )
    .map((t) => ({ param: t.type, value: t.slug, label: t.name }));
}
