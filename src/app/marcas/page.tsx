import type { Metadata } from "next";
import { Aurora } from "@/components/aurora";
import { getCurrentUser } from "@/lib/auth";
import { getLandingPhotos } from "@/lib/landing";
import { Hero } from "@/components/landing/hero";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { DialogueScene, TypingDots } from "@/components/landing/dialogue-scene";
import { RotatingText } from "@/components/landing/rotating-text";
import { BrandPanelPreview, HowToUpload, PostToStoreFlow } from "@/components/landing/brand-sections";
import { CtaLink } from "@/components/landing/ui";

export const metadata: Metadata = {
  title: "Icon para marcas — tu catálogo frente a quien busca lo tuyo",
  description:
    "Crea el perfil de tu marca colombiana independiente, etiqueta tus prendas y recibe a la gente en tu tienda o tu WhatsApp. Gratis por ahora, sin comisiones.",
  alternates: { canonical: "/marcas" },
  openGraph: {
    title: "Icon para marcas",
    description: "Tu marca frente a quien busca justo lo que haces. Gratis por ahora, sin comisiones.",
    url: "/marcas",
    siteName: "Icon",
    locale: "es_CO",
    type: "website",
  },
};

export default async function MarcasPage() {
  const [session, photos] = await Promise.all([getCurrentUser(), getLandingPhotos(6)]);
  const isBrand = session?.profile?.role === "brand";
  const join = isBrand ? { href: "/marca/panel", label: "Ir a mi panel" } : { href: "#como", label: "Únete ya" };

  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
        <LandingHeader audience="marcas" />

        <Hero
          steps={[
            { title: "Crea", text: "Tu perfil de marca: ciudad, estilos y portada." },
            { title: "Etiqueta", text: "Cada prenda con ocasión, estilo, clima y precio." },
            { title: "Vende", text: "En tu canal: tu tienda o tu WhatsApp. La venta es tuya." },
          ]}
          title={
            <>
              Tu marca frente a quien busca <em>justo lo que haces</em>.
            </>
          }
          lead="Crea tu perfil, etiqueta tus prendas y recibe a la gente en tu tienda o tu WhatsApp. Sin comisiones."
          actions={[join]}
        />

        <HowToUpload instagramLive={process.env.INSTAGRAM_IMPORT_ENABLED === "true"} />

        <div className="pt-8 sm:pt-12">
          <DialogueScene
            tone="coral"
            label="La gente busca por necesidad"
            question={
              <RotatingText
                items={[
                  <>Quiero algo para <em>una cena en Bogotá</em>…</>,
                  <>Quiero algo para <em>un matrimonio en la playa</em>…</>,
                  <>Quiero algo para <em>la oficina</em>…</>,
                ]}
              />
            }
            answer={<TypingDots />}
            caption="En Icon la gente busca por lo que va a hacer, no por marca. Si etiquetas bien, te encuentran."
          />
        </div>

        <BrandPanelPreview />
        <PostToStoreFlow photos={photos} />

        <div className="flex justify-center pb-6">
          <CtaLink href={join.href} big>
            {join.label}
          </CtaLink>
        </div>
      </div>
      <LandingFooter audience="marcas" />
    </>
  );
}
