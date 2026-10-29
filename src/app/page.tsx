import Link from "next/link";
import { Aurora } from "@/components/aurora";
import { SiteHeader } from "@/components/site-header";
import { CONTACT_PHONE, SiteFooter } from "@/components/site-footer";

const FOR_USERS = [
  { title: "Explora", text: "Outfits y prendas de marcas colombianas, con filtros por ocasión, ciudad, precio y estilo." },
  { title: "Guarda y sigue", text: "Guarda lo que te gusta y sigue a las marcas que te representan." },
  { title: "Compra directo", text: "Cada prenda te lleva a la tienda de la marca. Sin intermediarios." },
];

const FOR_BRANDS = [
  { title: "Crea tu perfil", text: "Nombre, ciudad, estilo y una portada que te represente." },
  { title: "Sube tu catálogo", text: "Prendas con precio, tallas y link a tu tienda. Y looks con esas prendas etiquetadas." },
  { title: "Te encuentran", text: "Tu marca aparece cuando alguien busca justo lo que haces. Revisamos cada perfil antes de publicarlo." },
];

const FAQ = [
  {
    q: "¿Cuánto cuesta?",
    a: "Nada. Icon es gratis para usuarios y, por ahora, también para las marcas.",
  },
  {
    q: "¿Icon vende la ropa?",
    a: "No. Te conectamos con la marca y compras en su tienda o su canal de siempre.",
  },
  {
    q: "¿Qué marcas pueden entrar?",
    a: "Marcas colombianas independientes con diseño propio. Revisamos cada perfil antes de publicarlo.",
  },
];

function Steps({ label, items }: { label: string; items: { title: string; text: string }[] }) {
  return (
    <div className="glass rounded-3xl p-6 sm:p-8">
      <p className="text-[11px] uppercase tracking-wide text-ink/50">{label}</p>
      <ol className="mt-5 space-y-5">
        {items.map((it, i) => (
          <li key={it.title} className="flex gap-4">
            <span className="font-mono text-sm text-coral">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3 className="font-medium text-forest">{it.title}</h3>
              <p className="mt-0.5 text-sm text-ink/70">{it.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <SiteHeader />

        <section className="flex min-h-[70dvh] flex-col justify-center py-16">
          <p className="text-[11px] uppercase tracking-[0.2em] text-ink/50">Hecho en Colombia</p>
          <h1 className="mt-4 text-5xl font-medium leading-tight tracking-tight text-forest sm:text-6xl">
            Moda colombiana
            <br />
            independiente.
          </h1>
          <p className="mt-4 max-w-md text-lg text-ink/70">
            Descubre tu próximo outfit con intención: por ocasión, ciudad, precio y estilo.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/feed"
              className="rounded-full bg-forest px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-forest-deep"
            >
              Explorar el feed
            </Link>
            <Link
              href="/signup"
              className="glass rounded-full px-6 py-3 text-sm font-medium text-forest hover:bg-white/40"
            >
              Crear cuenta
            </Link>
          </div>
        </section>

        <section aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="text-2xl font-medium tracking-tight text-forest">
            Cómo funciona
          </h2>
          <p className="mt-1 max-w-lg text-ink/60">
            Las marcas muestran lo que hacen. Tú encuentras lo que buscas, sin escarbar en cientos de
            cuentas.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Steps label="Para ti" items={FOR_USERS} />
            <Steps label="Para marcas" items={FOR_BRANDS} />
          </div>
        </section>

        <section aria-labelledby="unete" className="mt-24">
          <h2 id="unete" className="text-2xl font-medium tracking-tight text-forest">
            Únete
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link
              href="/signup"
              className="group glass rounded-3xl p-6 transition-colors hover:bg-white/40"
            >
              <p className="font-medium text-forest">Soy usuario →</p>
              <p className="mt-1 text-sm text-ink/70">
                Crea tu cuenta con tu correo o Google en menos de un minuto.
              </p>
            </Link>
            <Link
              href="/signup?tipo=marca"
              className="group rounded-3xl bg-forest p-6 text-white transition-colors hover:bg-forest-deep"
            >
              <p className="font-medium">Tengo una marca →</p>
              <p className="mt-1 text-sm text-white/75">
                Crea tu cuenta, arma tu perfil, sube al menos una prenda y envíalo a revisión.
              </p>
            </Link>
          </div>

          <dl className="mt-10 divide-y divide-ink/10 border-y border-ink/10">
            {FAQ.map((f) => (
              <div key={f.q} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <dt className="font-medium text-forest">{f.q}</dt>
                <dd className="text-sm text-ink/70">{f.a}</dd>
              </div>
            ))}
            <div className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <dt className="font-medium text-forest">¿Otra pregunta?</dt>
              <dd className="text-sm text-ink/70">
                Escríbenos por WhatsApp al{" "}
                <a href="https://wa.me/573152429478" className="font-medium text-forest underline-offset-2 hover:underline">
                  {CONTACT_PHONE}
                </a>
                . También nos sirve cualquier idea o comentario.
              </dd>
            </div>
          </dl>
        </section>

        <SiteFooter />
      </div>
    </>
  );
}
