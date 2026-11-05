import Link from "next/link";
import type { ReactNode } from "react";
import type { LandingPhoto } from "@/lib/landing";

// Piezas pequeñas compartidas por las dos landings.

export function SoonBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 self-start rounded-full bg-honey px-3 py-1 text-xs font-semibold text-ink ${className}`}
    >
      <span className="size-1.5 rounded-full bg-coral" aria-hidden />
      Próximamente
    </span>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-xs font-semibold uppercase tracking-[0.16em] text-forest ${className}`}>
      {children}
    </span>
  );
}

// Título de sección en serif; usar <em> para la parte en coral itálica.
export function DisplayTitle({
  as: Tag = "h2",
  children,
  className = "",
  id,
}: {
  as?: "h1" | "h2" | "h3";
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={`font-display text-[clamp(2.1rem,5.2vw,3.6rem)] leading-[1.02] font-normal tracking-tight text-balance text-ink [&_em]:text-coral ${className}`}
    >
      {children}
    </Tag>
  );
}

const BTN = {
  primary:
    "bg-coral text-white shadow-[0_8px_22px_color-mix(in_srgb,var(--color-coral)_35%,transparent)] hover:-translate-y-px",
  forest: "bg-forest text-white hover:bg-forest-deep",
  glass: "glass text-forest hover:bg-white/50",
} as const;

export function CtaLink({
  href,
  children,
  variant = "primary",
  big = false,
  className = "",
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof BTN;
  big?: boolean;
  className?: string;
  external?: boolean;
}) {
  const cls = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition ${
    big ? "min-h-14 px-8 text-lg" : "min-h-12 px-6 text-[15px]"
  } ${BTN[variant]} ${className}`;
  if (external)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

// Lista con check verde (o guion punteado para "Tú pones").
export function CheckList({ items, dashed = false }: { items: ReactNode[]; dashed?: boolean }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5">
          {dashed ? (
            <span className="mt-0.5 size-[22px] shrink-0 rounded-full border-[1.5px] border-dashed border-ink" aria-hidden />
          ) : (
            <span className="mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full bg-forest" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 12l4 4 8-8" />
              </svg>
            </span>
          )}
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

const PLACEHOLDER_BG = [
  "bg-blush",
  "bg-leaf-soft",
  "bg-honey-soft",
  "bg-sky",
  "bg-coral-soft",
];

// Foto real de prenda (o un fondo de la paleta si no hay suficientes fotos).
export function Photo({
  photo,
  i = 0,
  className = "",
  eager = false,
}: {
  photo?: LandingPhoto;
  i?: number;
  className?: string;
  eager?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden ${PLACEHOLDER_BG[i % PLACEHOLDER_BG.length]} ${className}`}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.src}
          alt={`${photo.title} · ${photo.brand}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}
