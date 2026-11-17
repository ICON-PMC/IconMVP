"use client";

import { useEffect, useState } from "react";
import { suggestStubs } from "./actions";

type Stub = { id: string; name: string; mentions: number };

/**
 * Spec 010, US3: bajo el nombre comercial, las marcas que la comunidad ya menciona con un nombre
 * parecido. Si elige una, al aprobarse la marca hereda esos looks.
 */
export function StubPicker({ name, initial }: { name: string; initial: Stub | null }) {
  const [results, setResults] = useState<{ q: string; rows: Stub[] } | null>(null);
  const [chosen, setChosen] = useState<string>(initial?.id ?? "");

  useEffect(() => {
    const q = name.trim();
    if (q.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      suggestStubs(q).then((rows) => alive && setResults({ q, rows }));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [name]);

  const fresh = results?.q === name.trim() ? results.rows : [];
  const options = [...(initial ? [initial] : []), ...fresh.filter((r) => r.id !== initial?.id)];
  if (!options.length) return <input type="hidden" name="claimed_stub" value="" />;

  return (
    <fieldset className="mt-3 rounded-xl border-[1.5px] border-line p-3">
      <legend className="px-1 text-sm font-semibold text-text">¿Te mencionan en Icon?</legend>
      <p className="mb-2 text-[13px] text-text-muted">
        La comunidad ya etiqueta estas marcas en sus looks. Si una eres tú, al aprobarte esos looks quedan conectados a tu página.
      </p>
      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-sunken">
            <input type="radio" name="claimed_stub" value={o.id} checked={chosen === o.id} onChange={() => setChosen(o.id)} className="size-4 accent-[var(--color-forest)]" />
            <span className="text-sm text-text">
              <strong className="font-semibold">{o.name}</strong>{" "}
              <span className="text-text-muted">
                · {o.mentions} {o.mentions === 1 ? "look" : "looks"}
              </span>{" "}
              — Esta es mi marca
            </span>
          </label>
        ))}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-sunken">
          <input type="radio" name="claimed_stub" value="" checked={chosen === ""} onChange={() => setChosen("")} className="size-4 accent-[var(--color-forest)]" />
          <span className="text-sm text-text">Ninguna</span>
        </label>
      </div>
    </fieldset>
  );
}
