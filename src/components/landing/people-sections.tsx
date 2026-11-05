import type { LandingPhoto } from "@/lib/landing";
import { formatCop } from "@/lib/landing";
import Link from "next/link";
import { Bookmark, ClothesBox } from "./illustrations";
import { RotatingText } from "./rotating-text";
import { CheckList, CtaLink, DisplayTitle, Eyebrow, Photo, SoonBadge } from "./ui";

// Respuesta del globo: una prenda real del catálogo.
export function GarmentAnswer({ photo }: { photo?: LandingPhoto }) {
  if (!photo) return <p className="text-sm text-ink/70">Prendas de marcas colombianas para tu plan.</p>;
  return (
    <Link href={photo.href} className="flex items-stretch gap-3">
      <Photo photo={photo} i={3} eager className="min-h-36 w-[46%] shrink-0 rounded-[18px]" />
      <div className="flex min-w-0 flex-col justify-center gap-1.5 text-sm">
        <b className="text-base leading-tight">{photo.title}</b>
        <span className="text-ink/65">
          {photo.brand}
          {photo.city ? ` · ${photo.city}` : ""}
        </span>
        {photo.price != null && <span className="font-semibold">{formatCop(photo.price)}</span>}
        <span className="text-xs font-semibold text-forest underline-offset-2 hover:underline">Ver prenda →</span>
      </div>
    </Link>
  );
}

// ── Comparte tu estilo + Escribe reseñas (Próximamente, FR-017) ─────────────
export function ComingSoonSections({ photos }: { photos: LandingPhoto[] }) {
  return (
    <>
      <section aria-labelledby="comparte-title" className="pb-12 sm:pb-20">
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <div className="flex min-w-0 flex-col gap-4">
            <SoonBadge />
            <DisplayTitle id="comparte-title">
              Comparte tu <em>estilo</em>.
            </DisplayTitle>
            <p className="max-w-[54ch] text-ink/70 sm:text-lg">
              Tu perfil público en iconcolombia.com/me, con tus outfits y las marcas colombianas que usas.
            </p>
            <div>
              <CtaLink href="/signup">Crea tu cuenta</CtaLink>
            </div>
          </div>
          <div
            aria-hidden
            className="mx-auto w-full max-w-[260px] rounded-[34px] border-2 border-ink bg-cream p-3 shadow-[12px_14px_0_var(--color-coral)] md:order-first"
          >
            <p className="mb-3 rounded-full bg-leaf-soft py-1.5 text-center text-xs font-semibold text-forest">
              iconcolombia.com/me
            </p>
            <div className="mb-3 flex items-center gap-2.5">
              <span className="size-11 rounded-full bg-honey" />
              <div>
                <b>Tu nombre</b>
                <p className="text-xs text-ink/60">Medellín · 12 outfits</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[4, 5, 6, 7].map((n, k) => (
                <Photo key={k} photo={photos[n]} i={k} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="resenas-title" className="pb-12 sm:pb-20">
        <div className="grid items-center gap-6 rounded-[28px] bg-honey-soft p-5 sm:p-10 md:grid-cols-2 md:gap-14">
          <div className="flex min-w-0 flex-col gap-4">
            <SoonBadge />
            <DisplayTitle id="resenas-title">
              Escribe <em>reseñas</em>.
            </DisplayTitle>
            <p className="max-w-[54ch] text-ink/70 sm:text-lg">
              Cuenta cómo te quedó y cómo fue comprarle a la marca. Ayudas a otras personas a elegir.
            </p>
          </div>
          <div aria-hidden className="grid grid-cols-[1.3fr_.7fr] items-center gap-3.5">
            <div className="flex flex-col gap-2.5">
              {[5, 4, 3].map((stars, k) => (
                <div key={k} className="flex flex-col gap-1 rounded-2xl border-[1.5px] border-ink bg-cream px-3.5 py-3">
                  <span className="tracking-[2px] text-coral">
                    {"★".repeat(stars)}
                    <span className="text-ink/25">{"★".repeat(5 - stars)}</span>
                  </span>
                  <span className="h-2 rounded bg-ink/15" style={{ width: `${90 - k * 15}%` }} />
                </div>
              ))}
            </div>
            <Photo photo={photos[8]} i={4} className="h-52 rounded-[18px]" />
          </div>
        </div>
      </section>
    </>
  );
}

// ── Guarda todos tus gustos ──────────────────────────────────────────────────
export function SavedSection({ photos }: { photos: LandingPhoto[] }) {
  return (
    <section aria-labelledby="guarda-title" className="pb-12 sm:pb-20">
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
        <div className="flex min-w-0 flex-col gap-4">
          <Eyebrow>Guarda</Eyebrow>
          <DisplayTitle id="guarda-title">
            Guarda todos tus gustos <em>para después</em>.
          </DisplayTitle>
          <CheckList
            items={[
              "Guarda prendas y outfits en tu lista.",
              "Dale like a lo que te gusta.",
              "Sigue a las marcas que te representan.",
            ]}
          />
        </div>
        <div aria-hidden className="grid grid-cols-[1fr_1.2fr] items-end gap-3.5 md:order-first">
          <ClothesBox className="block w-full" />
          <div className="relative grid grid-cols-3 gap-2 rounded-[18px] border-[1.5px] border-ink bg-cream p-3">
            <Bookmark className="absolute -top-6 right-4 w-7" />
            {[9, 10, 11].map((n, k) => (
              <Photo key={k} photo={photos[n]} i={k} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Mejora tu estilo con ropa de tu ciudad ───────────────────────────────────
export function CityCta({ href, label }: { href: string; label: string }) {
  return (
    <section aria-labelledby="ciudad-title" className="flex flex-col items-center gap-6 py-12 text-center sm:py-20">
      <h2 id="ciudad-title" className="font-display max-w-[16ch] text-[clamp(2.1rem,5.2vw,3.6rem)] leading-[1.05] text-balance">
        Mejora tu estilo con ropa de{" "}
        <span className="text-forest italic [background:linear-gradient(transparent_62%,var(--color-honey)_62%,var(--color-honey)_92%,transparent_92%)]">
          <RotatingText items={["tu ciudad", "Barranquilla", "Medellín", "Bogotá"]} every={2200} />
        </span>
        .
      </h2>
      <CtaLink href={href} big>
        {label}
      </CtaLink>
      <p className="text-sm text-ink/60">Gratis. Barranquilla · Medellín · Bogotá.</p>
    </section>
  );
}
