import type { ReactNode } from "react";
import { PersonLeft, PersonRight } from "./illustrations";

// Escena del boceto: una persona dice lo que necesita y del otro lado llega la respuesta.
// Escritorio: persona · globo · respuesta · persona. Móvil: globo, respuesta y las dos personas abajo.
export function DialogueScene({
  tone,
  question,
  answer,
  caption,
  label,
}: {
  tone: "forest" | "coral";
  question: ReactNode;
  answer: ReactNode;
  caption: ReactNode;
  label: string;
}) {
  const bg = tone === "forest" ? "bg-forest-deep" : "bg-coral";
  return (
    <section aria-label={label}>
      <div
        className={`grid grid-cols-2 items-end gap-3 overflow-hidden rounded-[28px] p-5 sm:p-10 md:grid-cols-[auto_1fr_1fr_auto] md:gap-7 ${bg}`}
      >
        <PersonRight
          fill={tone === "forest" ? "var(--color-coral-soft)" : "var(--color-honey-soft)"}
          className="order-3 w-[clamp(4.5rem,11vw,8rem)] md:order-none"
        />
        <div className="relative order-1 col-span-2 self-start rounded-[26px] bg-cream p-5 text-ink after:absolute after:-bottom-3 after:left-6 after:size-6 after:rotate-45 after:rounded-[4px] after:bg-cream sm:p-6 md:order-none md:col-span-1">
          <p className="font-display text-[clamp(1.5rem,3.2vw,2.4rem)] leading-[1.08] [&_em]:text-coral">
            {question}
          </p>
        </div>
        <div className="relative order-2 col-span-2 mt-2 rounded-[26px] bg-cream p-4 text-ink after:absolute after:right-6 after:-bottom-3 after:size-6 after:rotate-45 after:rounded-[4px] after:bg-cream sm:p-5 md:order-none md:col-span-1 md:mt-0">
          {answer}
        </div>
        <PersonLeft
          fill={tone === "forest" ? "var(--color-leaf)" : "var(--color-sky)"}
          hair={tone === "forest" ? "var(--color-forest)" : "var(--color-forest-deep)"}
          className="order-4 w-[clamp(4.5rem,11vw,8rem)] justify-self-end md:order-none"
        />
      </div>
      <p className="mt-4 text-center text-ink/70">{caption}</p>
    </section>
  );
}

// Puntos de "escribiendo…" (respuesta de la marca en la escena de /marcas).
export function TypingDots() {
  return (
    <span className="flex gap-2 px-1 py-1.5" role="img" aria-label="La marca está respondiendo">
      {[0, 150, 300, 450].map((d) => (
        <span
          key={d}
          className="size-2.5 animate-pulse rounded-full bg-forest motion-reduce:animate-none"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </span>
  );
}
