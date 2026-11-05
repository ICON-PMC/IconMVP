import type { Metadata } from "next";
import { Aurora } from "@/components/aurora";
import { getCurrentUser } from "@/lib/auth";
import { getLandingPhotos } from "@/lib/landing";
import { Hero } from "@/components/landing/hero";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { DialogueScene } from "@/components/landing/dialogue-scene";
import { RotatingText } from "@/components/landing/rotating-text";
import { SearchSection } from "@/components/landing/search-section";
import { NominationSection } from "@/components/landing/nomination";
import {
  CityCta,
  ComingSoonSections,
  GarmentAnswer,
  SavedSection,
} from "@/components/landing/people-sections";

export const metadata: Metadata = {
  title: "Icon — encuentra lo que necesitas, hecho en Colombia",
  description:
    "Moda colombiana independiente de Barranquilla, Medellín y Bogotá. Busca por ocasión, ciudad, precio y estilo, y compra directo a la marca.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Icon — moda colombiana independiente",
    description: "Encuentra lo que necesitas, hecho en Colombia. Busca por lo que vas a hacer, no por marca.",
    url: "/",
    siteName: "Icon",
    locale: "es_CO",
    type: "website",
  },
};

export default async function Home() {
  const [session, photos] = await Promise.all([getCurrentUser(), getLandingPhotos(12)]);
  const primary = session ? { href: "/feed", label: "Ir al feed" } : { href: "/signup", label: "Crea tu cuenta" };

  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
        <LandingHeader audience="personas" />

        <Hero
          steps={[
            { title: "Busca", text: "Por ocasión, ciudad, precio y estilo." },
            { title: "Muestra", text: "Ves qué marcas colombianas lo tienen." },
            { title: "Compra", text: "Directo a la marca, en su tienda o su WhatsApp." },
          ]}
          title={
            <>
              Encuentra lo que necesitas, <em>hecho en Colombia</em>.
            </>
          }
          lead="Moda independiente de Barranquilla, Medellín y Bogotá. Busca por lo que vas a hacer, no por marca."
          actions={
            session
              ? [primary]
              : [primary, { href: "/feed", label: "Explorar el feed", variant: "glass" }]
          }
        />

        <DialogueScene
          tone="forest"
          label="Busca por necesidad"
          question={
            <RotatingText
              items={[
                <>Necesito un <em>vestido fresco</em> para <em>un matrimonio en la playa</em></>,
                <>Necesito una <em>camisa de lino</em> para <em>la oficina en Barranquilla</em></>,
                <>Necesito algo <em>cómodo</em> para <em>un concierto en Medellín</em></>,
                <>Necesito un <em>abrigo</em> para <em>una cena en Bogotá</em></>,
              ]}
            />
          }
          answer={<GarmentAnswer photo={photos[0]} />}
          caption="Dinos qué vas a hacer. Te mostramos qué prendas de marcas colombianas te sirven."
        />

        <SearchSection />
        <ComingSoonSections photos={photos} />
        <SavedSection photos={photos} />
        <NominationSection />
        <CityCta href={primary.href} label={primary.label} />
      </div>
      <LandingFooter audience="personas" />
    </>
  );
}
