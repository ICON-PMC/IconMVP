import Link from "next/link";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import { MobileNav } from "@/components/mobile-nav";

// Header glass compartido con estado de sesión.
export async function SiteHeader() {
  const session = await getCurrentUser();
  const staff = isStaff(session?.profile);
  const isBrand = session?.profile?.role === "brand";
  // Enlace de rol (visible también en móvil) y menú con el resto.
  const roleLink = isBrand
    ? { href: "/marca/panel", label: "Mi marca" }
    : staff
      ? { href: "/admin", label: "Panel" }
      : null;
  const menuLinks = [
    { href: "/feed", label: "Explorar" },
    { href: "/saved", label: "Guardados" },
    { href: "/settings", label: "Ajustes" },
  ];

  return (
    <header className="glass flex items-center justify-between gap-3 rounded-full px-5 py-2 md:py-2.5">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-medium tracking-tight text-forest">
          Icon
        </Link>
        <Link
          href="/feed"
          className={`text-sm font-medium text-ink/70 hover:text-forest ${session ? "hidden md:inline" : ""}`}
        >
          Explorar
        </Link>
      </div>
      <nav className="flex items-center gap-3 text-sm">
        {session ? (
          <>
            {/* Móvil: enlace de rol + menú. */}
            <div className="flex items-center gap-1 md:hidden">
              {roleLink && (
                <Link
                  href={roleLink.href}
                  className="flex min-h-11 items-center px-2 font-medium text-forest"
                >
                  {roleLink.label}
                </Link>
              )}
              <MobileNav
                links={menuLinks}
                label={session.profile?.display_name ?? session.email}
              />
            </div>
            {/* Escritorio: todo en línea. */}
            <div className="hidden items-center gap-3 md:flex">
              <Link
                href="/saved"
                className="font-medium text-ink/70 hover:text-forest"
              >
                Guardados
              </Link>
              <Link
                href="/settings"
                className="font-medium text-ink/70 hover:text-forest"
              >
                Ajustes
              </Link>
              {staff && (
                <Link
                  href="/admin"
                  className="font-medium text-forest hover:underline"
                >
                  Panel
                </Link>
              )}
              {isBrand && (
                <Link
                  href="/marca/panel"
                  className="font-medium text-forest hover:underline"
                >
                  Mi marca
                </Link>
              )}
              <span className="hidden text-ink/60 sm:inline">
                {session.profile?.display_name ?? session.email}
              </span>
              <form action={signOut}>
                <button className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-deep">
                  Salir
                </button>
              </form>
            </div>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="font-medium text-ink/70 hover:text-forest"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-coral px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              Crear cuenta
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
