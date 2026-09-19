"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importInstagramMedia, type IgMediaOption } from "../actions";

export function ImportPicker({ items }: { items: IgMediaOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function importSelected() {
    if (!selected.size) {
      setMsg("Selecciona al menos una foto.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setErrors([]);
    try {
      const chosen = items
        .filter((it) => selected.has(it.id))
        .map((it) => ({ id: it.id, caption: it.caption, imageUrl: it.imageUrl }));
      const r = await importInstagramMedia(chosen);
      if (!r.ok) {
        setErrors([r.error]);
        return;
      }
      setErrors(r.errors);
      setMsg(
        r.errors.length
          ? `${r.created} foto(s) importada(s), ${r.errors.length} con error.`
          : `${r.created} foto(s) importada(s) como borrador.`,
      );
      setSelected(new Set());
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={importSelected}
          disabled={busy}
          className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-forest-deep disabled:opacity-50"
        >
          {busy ? "Importando…" : `Importar seleccionadas (${selected.size})`}
        </button>
        {msg && <span className="text-sm text-ink/70">{msg}</span>}
      </div>

      {errors.length > 0 && (
        <ul className="mb-4 space-y-1 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((it) => {
          const isSelected = selected.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => toggle(it.id)}
              className={`relative overflow-hidden rounded-xl border-2 text-left transition ${
                isSelected ? "border-forest" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.imageUrl}
                alt={it.caption ?? "post de Instagram"}
                className="aspect-square w-full object-cover"
              />
              <span
                className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isSelected ? "bg-forest text-white" : "bg-white/80 text-ink/40"
                }`}
              >
                {isSelected ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
