import { SettingsIcon } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { panelLink, type NavContext } from "@/lib/nav";

/**
 * Barra superior (spec 007, US2). En escritorio lleva los destinos en texto y la cuenta; en móvil
 * solo el wordmark y, si aplica, el acceso al panel (el resto vive en la barra inferior).
 */
export function TopBar({ ctx }: { ctx: NavContext }) {
  const panel = panelLink(ctx);
  const link = "rounded-full px-3 py-2 text-sm font-semibold text-text hover:bg-surface-sunken";
  return (
    <header className="bar-blur sticky top-0 z-40 border-b border-line">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 md:h-16 md:px-6">
        <Link href="/feed" className="wordmark text-[28px] leading-none text-text" aria-label="Icon, ir al inicio">
          ICON
        </Link>
        <nav aria-label="Navegación" className="flex items-center gap-1">
          <span className="hidden items-center gap-1 md:flex">
            <Link href="/feed" className={link}>
              Explorar
            </Link>
            {ctx.isLoggedIn && (
              <Link href="/saved" className={link}>
                Guardados
              </Link>
            )}
          </span>
          {panel && (
            <Link href={panel.href} className={link}>
              {panel.label}
            </Link>
          )}
          {ctx.isLoggedIn ? (
            <span className="hidden items-center gap-2 md:flex">
              <Link
                href={ctx.handle ? `/u/${ctx.handle}` : "/settings"}
                className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 hover:bg-surface-sunken"
              >
                <Avatar image={ctx.avatar} name={ctx.displayName} seed={ctx.seed} size={32} />
                <span className="max-w-40 truncate text-sm font-semibold">{ctx.displayName ?? "Cuenta"}</span>
              </Link>
              {ctx.handle && (
                <Link href="/settings" aria-label="Ajustes" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-surface-sunken">
                  <SettingsIcon className="size-[18px]" aria-hidden />
                </Link>
              )}
              <form action={signOut}>
                <Button variant="ghost" size="sm" type="submit">
                  Salir
                </Button>
              </form>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Link href="/login" className={link}>
                Entrar
              </Link>
              <Button size="sm" render={<Link href="/signup" />} nativeButton={false}>
                Crear cuenta
              </Button>
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
