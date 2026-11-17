// Navegación de la app (spec 007, contracts §1). Configuración pura: sin React ni servidor.

export type CentralAction = "photo-search" | "create-look";

/**
 * Acción central de la barra inferior. Con los looks de usuarios encendidos (spec 008, bandera
 * USER_LOOKS_ENABLED) es "Crear" (+); la búsqueda por foto queda dentro del buscador del feed.
 */
export function centralAction(ctx: Pick<NavContext, "userLooks">): CentralAction {
  return ctx.userLooks ? "create-look" : "photo-search";
}

export type NavRole = "user" | "brand" | "curator" | "admin" | null;
export type NavContext = {
  isLoggedIn: boolean;
  role: NavRole;
  handle: string | null; // perfil público (spec 009); null mientras no exista
  avatar: string | null;
  displayName: string | null;
  seed: string; // para el color del avatar sin foto
  userLooks: boolean; // spec 008: bandera de looks de usuarios (se lee en el servidor)
};

export type NavKey = "home" | "search" | "central" | "saved" | "account";
export type NavItem = { key: NavKey; label: string; href: string; requiresAuth: boolean };

const login = (next: string) => `/login?next=${encodeURIComponent(next)}`;

export function navItems(ctx: NavContext): NavItem[] {
  const central = centralAction(ctx);
  const account = ctx.handle ? `/u/${ctx.handle}` : "/settings";
  return [
    { key: "home", label: "Inicio", href: "/feed", requiresAuth: false },
    { key: "search", label: "Buscar", href: "/feed?buscar=1", requiresAuth: false },
    {
      key: "central",
      label: central === "create-look" ? "Crear look" : "Buscar por foto",
      href: central === "create-look" ? (ctx.isLoggedIn ? "/crear" : login("/crear")) : "/feed?visual=1",
      requiresAuth: true,
    },
    { key: "saved", label: "Guardados", href: ctx.isLoggedIn ? "/saved" : login("/saved"), requiresAuth: true },
    { key: "account", label: "Cuenta", href: ctx.isLoggedIn ? account : login(account), requiresAuth: true },
  ];
}

/** Acceso a panel según rol: marca → su panel; curador o admin → panel del equipo. */
export function panelLink(ctx: NavContext): { href: string; label: string } | null {
  if (ctx.role === "brand") return { href: "/marca/panel", label: "Mi marca" };
  if (ctx.role === "curator" || ctx.role === "admin") return { href: "/admin", label: "Panel" };
  return null;
}

export function activeNavKey(pathname: string, search: URLSearchParams): NavKey | null {
  if (pathname === "/feed") return search.get("buscar") === "1" ? "search" : search.get("visual") === "1" ? "central" : "home";
  if (pathname.startsWith("/saved")) return "saved";
  if (pathname.startsWith("/settings") || pathname.startsWith("/u/")) return "account";
  if (pathname.startsWith("/crear")) return "central";
  return null;
}
