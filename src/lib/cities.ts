import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Una ciudad lista para `CityCombobox`: `value` es el id (o el slug en filtros por URL). */
export type CityOption = { value: string; label: string };

// PostgREST corta cada respuesta en `max_rows` (1000 por defecto) y hay 1.122 municipios:
// se pide por páginas para no perder ciudades en silencio.
const PAGE = 1000;

/** "Rionegro, Antioquia". Bogotá ya trae el distrito en el departamento: "Bogotá, D.C.". */
export function cityLabel(name: string, department: string | null): string {
  if (!department) return name;
  if (department.startsWith(name)) return department;
  return `${name}, ${department}`;
}

/** Todos los municipios, por nombre. `by` elige si el valor es el id (formularios) o el slug. */
export async function getCityOptions(
  supabase: Supabase,
  by: "id" | "slug" = "id",
): Promise<CityOption[]> {
  const rows: { id: string; slug: string; name: string; department: string | null }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("cities")
      .select("id, slug, name, department")
      .order("name")
      .order("department")
      .range(from, from + PAGE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.map((c) => ({ value: by === "id" ? c.id : c.slug, label: cityLabel(c.name, c.department) }));
}

/**
 * Ciudades con al menos una marca activa, por slug (decisión 5 del spec 2026-10-06): el filtro
 * del feed no lista 1.100 municipios sin contenido.
 */
export async function getCityFilterOptions(supabase: Supabase): Promise<CityOption[]> {
  const { data: brands } = await supabase.from("brands").select("city_id").eq("is_active", true);
  const ids = [...new Set((brands ?? []).flatMap((b) => (b.city_id ? [b.city_id] : [])))];
  if (!ids.length) return [];
  const { data } = await supabase
    .from("cities")
    .select("slug, name, department")
    .in("id", ids)
    .order("name");
  return (data ?? []).map((c) => ({ value: c.slug, label: cityLabel(c.name, c.department) }));
}
