"use client";

import { useState, type FormEvent, type ReactNode } from "react";

const TEAM_WHATSAPP = "573152429478";

export type WaField = {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  hint?: string;
  autoComplete?: string;
};

// Formulario que arma un mensaje y abre el WhatsApp del equipo.
// Versión inicial de la captura de interés: no guarda nada en Icon (el registro en base de
// datos y el aviso al grupo llegan en la siguiente fase de specs/002-public-landings).
export function WhatsappForm({
  fields,
  intro,
  submitLabel,
  buildMessage,
  success,
}: {
  fields: WaField[];
  intro: string;
  submitLabel: string;
  buildMessage: (v: Record<string, string>) => string;
  success: ReactNode;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const values: Record<string, string> = {};
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const v = String(data.get(f.name) ?? "").trim();
      values[f.name] = v;
      if (f.required && !v) errs[f.name] = "Este dato es obligatorio.";
    }
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      e.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    const text = `${intro}\n${buildMessage(values)}`;
    window.open(`https://wa.me/${TEAM_WHATSAPP}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setSent(true);
  }

  const input =
    "glass-input w-full rounded-[14px] px-3.5 py-3 text-base font-normal text-ink placeholder:text-ink/40";

  return (
    <div>
      <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const err = errors[f.name];
          const id = `wa-${f.name}`;
          return (
            <label key={f.name} htmlFor={id} className="flex flex-col gap-1.5 text-[13px] font-semibold">
              <span>
                {f.label}{" "}
                {!f.required && <span className="font-normal text-ink/60">(opcional)</span>}
              </span>
              {f.options ? (
                <select id={id} name={f.name} className={input} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} defaultValue="">
                  <option value="">Elige…</option>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  name={f.name}
                  type="text"
                  placeholder={f.placeholder}
                  autoComplete={f.autoComplete ?? "off"}
                  className={input}
                  aria-invalid={!!err}
                  aria-describedby={err ? `${id}-err` : undefined}
                />
              )}
              {err && (
                <span id={`${id}-err`} className="text-[12.5px] font-medium text-[#b8381a]">
                  {err}
                </span>
              )}
            </label>
          );
        })}
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="mt-1 inline-flex min-h-12 items-center justify-center rounded-full bg-coral px-6 font-semibold text-white shadow-[0_8px_22px_color-mix(in_srgb,var(--color-coral)_35%,transparent)]"
          >
            {submitLabel}
          </button>
          <p className="mt-2 text-xs text-ink/60">Se abre WhatsApp con tu mensaje listo para enviar.</p>
        </div>
      </form>
      {sent && (
        <div role="status" className="mt-5 flex flex-col gap-2 rounded-[20px] border-[1.5px] border-forest bg-leaf-soft p-5">
          {success}
        </div>
      )}
    </div>
  );
}
