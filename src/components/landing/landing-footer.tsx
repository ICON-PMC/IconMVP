import Link from "next/link";
import { CONTACT_PHONE } from "@/components/site-footer";
import { whatsappLink } from "@/lib/landing";

type Col = { title: string; links: { href: string; label: string }[] };

const COLS: Record<"personas" | "marcas", Col[]> = {
  personas: [
    { title: "Icon", links: [{ href: "/feed", label: "Explorar el feed" }, { href: "/signup", label: "Crear cuenta" }, { href: "/login", label: "Entrar" }] },
    { title: "Marcas", links: [{ href: "/marcas", label: "Icon para marcas" }, { href: "#postula", label: "Postula una marca" }] },
  ],
  marcas: [
    { title: "Marcas", links: [{ href: "/signup?tipo=marca", label: "Crear cuenta de marca" }, { href: "#como", label: "Subida asistida" }, { href: "/marca/panel", label: "Entrar a mi panel" }] },
    { title: "Icon", links: [{ href: "/", label: "Para personas" }, { href: "/feed", label: "Explorar el feed" }] },
  ],
};

// Pie de las landings: borde superior ondulado (boceto), enlaces por audiencia y WhatsApp.
export function LandingFooter({ audience }: { audience: "personas" | "marcas" }) {
  return (
    <footer className="relative mt-16 bg-forest-deep text-cream sm:mt-24">
      <svg
        viewBox="0 0 1000 30"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute -top-7 left-0 h-[30px] w-full"
      >
        <path d="M0 30 C120 6 260 4 420 14 C600 26 780 0 1000 10 L1000 30 Z" fill="var(--color-forest-deep)" />
      </svg>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-10 px-4 py-12 sm:px-8">
        <div className="max-w-xs">
          <p className="wordmark text-[40px]">ICON</p>
          <p className="mt-2 text-cream/75">
            {audience === "marcas" ? "¿Dudas? Escríbenos por WhatsApp." : "Moda colombiana independiente."}
          </p>
          <a
            href={whatsappLink("Hola, Icon 👋")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-coral px-5 font-semibold text-white"
          >
            WhatsApp {CONTACT_PHONE}
          </a>
        </div>
        <div className="flex flex-wrap gap-10">
          {COLS[audience].map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="mb-1.5 text-xs font-semibold tracking-[0.14em] text-leaf uppercase">{c.title}</p>
              {c.links.map((l) => (
                <Link key={l.href} href={l.href} className="block py-1 text-cream/85 hover:text-cream hover:underline">
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-cream/50 sm:px-8">
        © {new Date().getFullYear()} Icon · Hecho en Colombia
      </p>
    </footer>
  );
}
