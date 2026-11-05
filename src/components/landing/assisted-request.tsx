"use client";

import { useRef, useState } from "react";
import { WhatsappForm } from "./whatsapp-form";

const CITIES = ["Barranquilla", "Medellín", "Bogotá", "Otra"];

// Botón "Solicitar" de la opción B: despliega el formulario de subida asistida.
export function AssistedRequest() {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  return (
    <div>
      {!open && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls="subida-asistida"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => panel.current?.querySelector("input")?.focus());
          }}
          className="inline-flex min-h-12 items-center rounded-full bg-coral px-6 font-semibold text-white shadow-[0_8px_22px_color-mix(in_srgb,var(--color-coral)_35%,transparent)]"
        >
          Solicitar
        </button>
      )}
      {open && (
        <div
          id="subida-asistida"
          ref={panel}
          className="mt-1 rounded-[22px] border-[1.5px] border-ink bg-cream p-4 shadow-[8px_10px_0_var(--color-coral-soft)] sm:p-5"
        >
          <h4 className="font-display text-[28px] leading-tight">Solicita la subida asistida</h4>
          <p className="mt-1 mb-4 text-sm text-ink/70">Te escribimos el mismo día hábil para coordinar.</p>
          <WhatsappForm
            intro="Hola, Icon 👋 Quiero la subida asistida de mi catálogo."
            submitLabel="Solicitar"
            fields={[
              { name: "marca", label: "Nombre de la marca", required: true },
              { name: "nombre", label: "Tu nombre", required: true, autoComplete: "name" },
              { name: "enlace", label: "Tienda online o Instagram", required: true, placeholder: "https://… o @tumarca" },
              { name: "ciudad", label: "Ciudad", required: true, options: CITIES },
              { name: "mensaje", label: "Mensaje", placeholder: "Ej.: tengo 40 prendas en Shopify" },
            ]}
            buildMessage={(v) =>
              [
                `Marca: ${v.marca}`,
                `Mi nombre: ${v.nombre}`,
                `Tienda o Instagram: ${v.enlace}`,
                `Ciudad: ${v.ciudad}`,
                v.mensaje && `Mensaje: ${v.mensaje}`,
              ]
                .filter(Boolean)
                .join("\n")
            }
            success={
              <>
                <b className="font-display text-[26px] leading-tight font-normal text-forest">
                  Envía el mensaje en WhatsApp y listo.
                </b>
                <span className="text-sm">
                  Te respondemos <strong>hoy mismo</strong>. Si nos escribes fuera de horario o en fin de
                  semana, te respondemos el siguiente día hábil.
                </span>
              </>
            }
          />
        </div>
      )}
    </div>
  );
}
