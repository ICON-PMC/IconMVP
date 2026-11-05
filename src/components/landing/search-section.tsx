"use client";

import Link from "next/link";
import { useState } from "react";
import { ShirtHolder } from "./illustrations";

// Chips de ejemplo con slugs reales del feed (`/feed?city=…&price=…&style=…`).
const GROUPS = [
  {
    key: "city",
    label: "Ciudad",
    chips: [
      ["barranquilla", "Barranquilla"],
      ["medellin", "Medellín"],
      ["bogota", "Bogotá"],
    ],
  },
  {
    key: "price",
    label: "Precio",
    chips: [
      ["under_100k", "< $100 mil"],
      ["100k_200k", "$100–200 mil"],
      ["200k_350k", "$200–350 mil"],
    ],
  },
  {
    key: "style",
    label: "Estilo",
    chips: [
      ["tropical", "Tropical"],
      ["minimalista", "Minimalista"],
      ["streetwear", "Streetwear"],
    ],
  },
] as const;

const INITIAL: Record<string, string[]> = { city: ["medellin"], price: [], style: ["tropical"] };

// "Busca todo lo que necesites": filtros de ejemplo que llevan al feed ya filtrado.
export function SearchSection() {
  const [sel, setSel] = useState<Record<string, string[]>>(INITIAL);
  const toggle = (k: string, v: string) =>
    setSel((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));
  const qs = new URLSearchParams(
    Object.entries(sel).flatMap(([k, v]) => (v.length ? [[k, v.join(",")]] : [])),
  ).toString();

  return (
    <section aria-labelledby="busca-title" className="py-12 sm:py-20">
      <div className="grid items-center gap-6 rounded-[28px] bg-[color-mix(in_srgb,var(--color-sky)_55%,var(--color-cream))] p-5 sm:p-10 md:grid-cols-2 md:gap-14">
        <ShirtHolder className="mx-auto block w-full max-w-[320px] transition-transform duration-500 hover:-rotate-3 hover:scale-105 motion-reduce:transition-none" />
        <div className="flex min-w-0 flex-col gap-4">
          <span className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Busca</span>
          <h2
            id="busca-title"
            className="font-display text-[clamp(2.1rem,5.2vw,3.6rem)] leading-[1.02] text-balance [&_em]:text-coral"
          >
            Busca todo lo que <em>necesites</em>.
          </h2>
          <div className="flex flex-col gap-3" role="group" aria-label="Filtros de ejemplo">
            {GROUPS.map((g) => (
              <div key={g.key} className="flex flex-wrap items-center gap-2">
                <b className="w-20 text-xs font-semibold tracking-[0.12em] text-ink/60 uppercase">{g.label}</b>
                {g.chips.map(([v, l]) => {
                  const on = sel[g.key].includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(g.key, v)}
                      className={`min-h-9 rounded-full border-[1.5px] border-ink px-3 text-sm transition duration-200 active:scale-95 ${
                        on ? "bg-ink text-cream" : "hover:-translate-y-0.5 hover:bg-white/60"
                      }`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div>
            <Link
              href={qs ? `/feed?${qs}` : "/feed"}
              className="group inline-flex min-h-12 items-center rounded-full bg-forest px-6 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-forest-deep"
            >
              Buscar en el feed <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
