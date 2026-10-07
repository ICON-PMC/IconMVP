import Link from "next/link";

export const CONTACT_PHONE = "+57 315 242 9478";
const WHATSAPP_URL = `https://wa.me/573152429478?text=${encodeURIComponent("Hola, Icon 👋")}`;

const LINKS = [
  { href: "/feed", label: "Explorar" },
  { href: "/signup", label: "Crear cuenta" },
  { href: "/signup?tipo=marca", label: "Registrar mi marca" },
  { href: "/login", label: "Entrar" },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink/10 pt-10 pb-8 text-sm">
      <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <Link href="/" className="text-lg font-medium tracking-tight text-forest">
            Icon
          </Link>
          <p className="mt-2 text-ink/60">
            Moda colombiana independiente, encontrada con intención.
          </p>
        </div>

        <nav aria-label="Pie de página" className="grid grid-cols-2 gap-x-10 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap text-ink/70 hover:text-forest">
              {l.label}
            </Link>
          ))}
        </nav>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink/50">Ideas, dudas o info</p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-11 items-center whitespace-nowrap font-medium text-forest hover:underline"
          >
            WhatsApp {CONTACT_PHONE}
          </a>
        </div>
      </div>

      <p className="mt-10 text-xs text-ink/40">
        © {new Date().getFullYear()} Icon · Hecho en Colombia
      </p>
    </footer>
  );
}
