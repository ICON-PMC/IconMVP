import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Privacidad · Icon",
  description: "Qué datos guarda Icon, para qué los usa y cómo borrarlos.",
};

// Página estática (spec 003, contracts §7). Texto llano, sin jerga.
export default function PrivacyPage() {
  return (
    <PageShell width="2xl">
      <SiteHeader />
      <article className="mx-auto mt-8 flex max-w-2xl flex-col gap-6 text-[15px] leading-7 text-text">
        <header>
          <h1 className="text-h1 text-text">Privacidad</h1>
          <p className="mt-2 text-text-muted">Qué datos guarda Icon, para qué los usa y cómo borrarlos.</p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-h3">Qué guardamos</h2>
          <ul className="list-disc pl-5">
            <li>
              <strong>Tu cuenta:</strong> correo, nombre, nombre de usuario, foto, ciudad y los estilos que elijas.
            </li>
            <li>
              <strong>Lo que publicas:</strong> tus looks, reseñas y las marcas o prendas que etiquetas.
            </li>
            <li>
              <strong>Tu actividad dentro de Icon:</strong> qué prendas, looks y marcas ves, abres, guardas, te gustan o sigues,
              qué buscas y en qué tiendas haces clic.
            </li>
          </ul>
          <p>
            Si no tienes cuenta, la actividad se guarda sin nada que te identifique: usamos una clave al azar que dura
            solo mientras tengas abierta la pestaña.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-h3">Para qué</h2>
          <ul className="list-disc pl-5">
            <li>Para ordenar el contenido según lo que te interesa (la vista &ldquo;Para ti&rdquo;).</li>
            <li>Para mejorar la búsqueda: por ejemplo, qué búsquedas no encuentran nada.</li>
            <li>
              Para darles a las marcas números agregados (cuántas veces se vieron o se visitaron sus prendas). Nunca ven
              quién eres.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-h3">Lo que no hacemos</h2>
          <p>No vendemos tus datos ni los compartimos con terceros para publicidad.</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-h3">Cuánto tiempo</h2>
          <p>
            La actividad detallada (qué viste y qué buscaste) se borra a los 180 días. Tu cuenta y lo que publicas se
            guardan mientras tengas la cuenta.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-h3">Cómo borrar tus datos</h2>
          <p>
            En{" "}
            <Link href="/settings" className="font-semibold text-action-text hover:underline">
              Ajustes
            </Link>{" "}
            puedes borrar tu cuenta: se borran tu perfil, tus looks, tus reseñas, tus fotos y tu actividad. Si tienes
            dudas, escríbenos.
          </p>
        </section>
      </article>
    </PageShell>
  );
}
