import type { ReactNode } from "react";
import { CtaLink, DisplayTitle } from "./ui";

type Step = { title: string; text: string };

const STEP_BG = ["bg-coral-soft", "bg-honey-soft", "bg-leaf-soft"];

// Líneas que bajan de cada tarjeta y convergen en el horizonte (boceto). Coordenadas en un
// viewBox 1000×120 estirado al ancho; las tarjetas están centradas en ~17 %, 50 % y 83 %.
const RAYS: { d: string; color: string }[] = [
  { d: "M110 0 C120 70 400 80 490 116", color: "var(--color-coral)" },
  { d: "M170 0 C180 60 420 76 494 116", color: "var(--color-ink)" },
  { d: "M230 0 C240 50 440 70 498 116", color: "var(--color-coral)" },
  { d: "M470 0 C474 60 492 90 496 116", color: "var(--color-honey)" },
  { d: "M500 0 L500 116", color: "var(--color-ink)" },
  { d: "M530 0 C526 60 508 90 504 116", color: "var(--color-honey)" },
  { d: "M770 0 C760 50 560 70 502 116", color: "var(--color-forest)" },
  { d: "M830 0 C820 60 580 76 506 116", color: "var(--color-ink)" },
  { d: "M890 0 C880 70 600 80 510 116", color: "var(--color-forest)" },
  { d: "M-20 117 C200 112 420 119 500 117 C640 115 820 112 1020 116", color: "var(--color-ink)" },
];

// Hero del boceto: wordmark ICON → 3 pasos numerados → líneas al horizonte → titular + CTA.
export function Hero({
  steps,
  title,
  lead,
  actions,
}: {
  steps: [Step, Step, Step];
  title: ReactNode;
  lead: ReactNode;
  actions: { href: string; label: string; variant?: "primary" | "glass" }[];
}) {
  return (
    <section aria-labelledby="hero-title" className="pt-5 sm:pt-9">
      <div className="text-center">
        <p
          aria-label="ICON"
          className="wordmark inline-block px-[0.12em] pb-10 text-[clamp(5.25rem,17vw,12.5rem)] text-forest transition-transform duration-500 hover:scale-[1.03] sm:pb-14 lg:pb-16"
        >
          ICON
        </p>
      </div>

      <ol className="grid grid-cols-3 gap-2.5 sm:gap-6 lg:gap-10">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={`group relative min-w-0 rounded-[20px] border-[1.5px] border-ink px-2 pt-5 pb-3 text-center transition duration-300 hover:-translate-y-1 hover:shadow-[5px_6px_0_var(--color-ink)] motion-reduce:transition-none sm:px-6 sm:pt-7 sm:pb-6 ${STEP_BG[i]} ${i === 1 ? "hover:rotate-1" : "hover:-rotate-1"}`}
          >
            <span
              aria-hidden
              className="font-display absolute top-[-0.55em] left-[0.12em] text-[clamp(2.4rem,6.4vw,4.9rem)] leading-none text-ink transition-colors duration-300 group-hover:text-coral"
            >
              {i + 1}
            </span>
            <p className="text-[13px] font-semibold tracking-[0.06em] uppercase sm:text-[17px] sm:tracking-[0.12em]">
              <span className="sr-only">Paso {i + 1}: </span>
              {s.title}
            </p>
            <p className="mt-1.5 hidden text-sm text-ink/70 sm:block">{s.text}</p>
          </li>
        ))}
      </ol>

      <svg
        viewBox="0 0 1000 120"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="block h-[clamp(3.75rem,10vw,8rem)] w-full overflow-visible"
      >
        <g fill="none" strokeWidth="2.5" strokeLinecap="round">
          {RAYS.map((r, i) => (
            <path
              key={r.d}
              d={r.d}
              stroke={r.color}
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              className="draw-line"
              style={{ animationDelay: `${i * 70}ms` }}
            />
          ))}
        </g>
      </svg>

      <div className="flex flex-col items-center gap-4 pt-5 pb-10 text-center sm:pt-8 sm:pb-16">
        <DisplayTitle as="h1" id="hero-title" className="max-w-[20ch] text-[clamp(1.9rem,4.6vw,3.4rem)]">
          {title}
        </DisplayTitle>
        <p className="max-w-[54ch] text-base text-ink/70 sm:text-lg">{lead}</p>
        <div className="flex flex-wrap justify-center gap-2.5">
          {actions.map((a) => (
            <CtaLink key={a.href + a.label} href={a.href} variant={a.variant ?? "primary"}>
              {a.label}
            </CtaLink>
          ))}
        </div>
      </div>
    </section>
  );
}
