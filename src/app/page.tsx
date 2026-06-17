import Link from "next/link";
import { Aurora } from "@/components/aurora";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <Aurora />
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-6 py-8">
        <SiteHeader />

        <section className="flex flex-1 flex-col justify-center">
          <h1 className="text-5xl font-medium leading-tight tracking-tight text-forest">
            Moda colombiana
            <br />
            independiente.
          </h1>
          <p className="mt-4 max-w-md text-lg text-ink/70">
            Descubre tu próximo outfit con intención: por ocasión, ciudad, precio
            y estilo.
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
      </div>
    </>
  );
}
