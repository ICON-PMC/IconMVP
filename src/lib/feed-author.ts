import type { Database } from "@/lib/database.types";

// Sin dependencias de servidor: lo usan tarjetas que se renderizan en el cliente.
type FeedItem = Database["public"]["Functions"]["get_feed"]["Returns"][number];

/**
 * Autor que muestra una tarjeta del feed (spec 008, regla de tolerancia): un look de usuario muestra
 * a su autor (enlace a su perfil, spec 009); todo lo demás, su marca. Nunca asume marca no nula.
 */
export function feedItemAuthor(
  item: Pick<FeedItem, "id" | "brand_name" | "brand_slug" | "brand_id" | "author_type" | "author_user_id" | "author_name" | "author_handle" | "author_avatar">,
): { name: string; avatar: string | null; href: string | null; seed: string; isUser: boolean } {
  if (item.author_type === "user") {
    return {
      name: item.author_name ?? item.author_handle ?? "Usuario",
      avatar: item.author_avatar ?? null,
      href: item.author_handle ? `/u/${item.author_handle}` : null,
      seed: item.author_user_id ?? item.id,
      isUser: true,
    };
  }
  return {
    name: item.brand_name ?? "Icon",
    avatar: null,
    href: item.brand_slug ? `/marca/${item.brand_slug}` : null,
    seed: item.brand_id ?? item.id,
    isUser: false,
  };
}
