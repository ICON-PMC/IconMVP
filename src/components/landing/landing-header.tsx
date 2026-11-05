import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

// Header de las landings: wordmark, switch de audiencia y entrar / ir a tu espacio.
export async function LandingHeader({ audience }: { audience: "personas" | "marcas" }) {
  const session = await getCurrentUser();
  const isBrand = session?.profile?.role === "brand";
  const right = !session
    ? { href: "/login", label: "Entrar" }
    : isBrand
      ? { href: "/marca/panel", label: "Mi marca" }
      : { href: "/feed", label: "Explorar" };

  const tab = (active: boolean) =>
    `flex min-h-9 items-center whitespace-nowrap rounded-full px-3 font-medium transition-colors ${
      active ? "bg-forest text-white" : "text-ink/65 hover:text-forest"
    }`;

  return (
    <header className="glass mt-3 flex items-center justify-between gap-2 rounded-full py-2 pr-2 pl-4 sm:pl-5">
      <Link href="/" className="wordmark text-[26px] text-forest" aria-label="Icon, inicio">
        ICON
      </Link>
      <nav aria-label="Audiencia" className="flex rounded-full bg-white/50 p-[3px] text-[13px]">
        <Link href="/" className={tab(audience === "personas")} aria-current={audience === "personas" ? "page" : undefined}>
          Soy persona
        </Link>
        <Link href="/marcas" className={tab(audience === "marcas")} aria-current={audience === "marcas" ? "page" : undefined}>
          Tengo una marca
        </Link>
      </nav>
      <Link href={right.href} className="hidden min-h-9 items-center px-3 text-sm font-medium text-forest sm:flex">
        {right.label}
      </Link>
    </header>
  );
}
