"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  uploadGarmentImageAction,
  deleteGarmentAction,
  deleteAllPendingAction,
} from "./actions";

export type PendingItem = { id: string; title: string; subtitle: string };

const MAX_BYTES = 10 * 1024 * 1024; // coincide con serverActions.bodySizeLimit

export function PendingGarments({ items }: { items: PendingItem[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function uploadAll() {
    const form = formRef.current;
    if (!form) return;
    setBusy(true);
    setMsg(null);
    setErrors([]);
    try {
      const fd = new FormData(form);
      const selected = items
        .map((it) => ({ it, file: fd.get(`image:${it.id}`) }))
        .filter(
          (x): x is { it: PendingItem; file: File } =>
            x.file instanceof File && x.file.size > 0,
        );
      if (!selected.length) {
        setMsg("Selecciona al menos una foto.");
        return;
      }

      const results = await Promise.all(
        selected.map(async ({ it, file }) => {
          if (file.size > MAX_BYTES)
            return { ok: false, error: `${it.title}: imagen muy grande (máx 10 MB)` };
          try {
            const sub = new FormData();
            sub.set("garment_id", it.id);
            sub.set("image", file);
            const r = await uploadGarmentImageAction(sub);
            return r.ok
              ? { ok: true as const }
              : { ok: false, error: `${it.title}: ${r.error ?? "error desconocido"}` };
          } catch (e) {
            return {
              ok: false,
              error: `${it.title}: ${e instanceof Error ? e.message : "fallo de red/servidor"}`,
            };
          }
        }),
      );

      const errs = results.filter((r) => !r.ok).map((r) => r.error!);
      const okCount = results.length - errs.length;
      setErrors(errs);
      setMsg(
        errs.length
          ? `${okCount} publicada(s), ${errs.length} con error.`
          : `${okCount} foto(s) subida(s) y publicada(s).`,
      );
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function removeOne(id: string) {
    setBusy(true);
    setMsg(null);
    setErrors([]);
    try {
      const r = await deleteGarmentAction(id);
      if (!r.ok) setErrors([r.error ?? "Error al eliminar."]);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function removeAll() {
    if (
      !window.confirm(
        `¿Eliminar las ${items.length} prendas pendientes sin foto? No se puede deshacer.`,
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    setErrors([]);
    try {
      const r = await deleteAllPendingAction();
      setMsg(r.ok ? `${r.deleted} prenda(s) eliminada(s).` : null);
      if (!r.ok) setErrors([r.error ?? "Error al eliminar."]);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  if (!items.length)
    return (
      <p className="mt-4 text-sm text-ink/50">
        No hay prendas pendientes de foto. 🎉
      </p>
    );

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={uploadAll}
          disabled={busy}
          className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-forest-deep disabled:opacity-50"
        >
          {busy ? "Procesando…" : "Subir todas las fotos seleccionadas"}
        </button>
        <button
          type="button"
          onClick={removeAll}
          disabled={busy}
          className="rounded-full bg-coral/15 px-4 py-2 text-sm font-medium text-coral hover:bg-coral/25 disabled:opacity-50"
        >
          Eliminar todas
        </button>
        {msg && <span className="text-sm text-ink/70">{msg}</span>}
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {items.map((it) => (
          <div key={it.id} className="glass-input flex flex-col gap-2 rounded-xl p-3">
            <p className="text-sm font-medium text-ink">{it.title}</p>
            <p className="text-xs text-ink/60">{it.subtitle}</p>
            <input
              type="file"
              name={`image:${it.id}`}
              accept="image/*"
              className="text-xs text-ink file:mr-2 file:rounded-full file:border-0 file:bg-forest file:px-2 file:py-1 file:text-xs file:text-white"
            />
            <button
              type="button"
              onClick={() => removeOne(it.id)}
              disabled={busy}
              className="self-start text-xs font-medium text-coral hover:underline disabled:opacity-50"
            >
              Eliminar
            </button>
          </div>
        ))}
      </form>
    </div>
  );
}
