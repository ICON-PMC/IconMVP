import Link from "next/link";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";

// Header glass compartido con estado de sesión.
export async function SiteHeader() {
  const session = await getCurrentUser();
  const staff = isStaff(session?.profile);

  return (
    <header className="glass flex items-center justify-between gap-3 rounded-full px-5 py-2.5">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-medium tracking-tight text-forest">
          Icon
        </Link>
        <Link
          href="/feed"
          className="text-sm font-medium text-ink/70 hover:text-forest"
        >
          Explorar
        </Link>
      </div>
      <nav className="flex items-center gap-3 text-sm">
        {session ? (
          <>
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
            <span className="hidden text-ink/60 sm:inline">
              {session.profile?.display_name ?? session.email}
            </span>
            <form action={signOut}>
              <button className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-deep">
                Salir
              </button>
            </form>
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
