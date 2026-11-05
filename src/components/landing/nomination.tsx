"use client";

import { WhatsappForm } from "./whatsapp-form";
import { DisplayTitle, Eyebrow } from "./ui";

// "Postula una marca" (boceto): por ahora abre WhatsApp con la postulación.
export function NominationSection() {
  return (
    <section id="postula" aria-labelledby="postula-title" className="scroll-mt-6 pb-4">
      <div className="rounded-[28px] bg-leaf-soft p-5 sm:p-10">
        <div className="mx-auto max-w-[640px]">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <Eyebrow>Postula una marca</Eyebrow>
            <DisplayTitle id="postula-title">
              ¿Qué marca quieres ver en <em>Icon</em>?
            </DisplayTitle>
            <p className="max-w-[54ch] text-ink/70 sm:text-lg">
              Si conoces una marca colombiana independiente que no está aquí, cuéntanos y la invitamos.
            </p>
          </div>
          <WhatsappForm
            intro="Hola, Icon 👋 Quiero postular una marca."
            submitLabel="Postular"
            fields={[
              { name: "marca", label: "Nombre de la marca", required: true },
              { name: "enlace", label: "Instagram o enlace", required: true, placeholder: "@marca o https://…" },
              { name: "ciudad", label: "Ciudad", options: ["Barranquilla", "Medellín", "Bogotá", "Otra"] },
              { name: "porque", label: "¿Por qué te gusta?", placeholder: "Opcional" },
            ]}
            buildMessage={(v) =>
              [
                `Marca: ${v.marca}`,
                `Instagram o enlace: ${v.enlace}`,
                v.ciudad && `Ciudad: ${v.ciudad}`,
                v.porque && `Por qué: ${v.porque}`,
              ]
                .filter(Boolean)
                .join("\n")
            }
            success={
              <>
                <b className="font-display text-[26px] leading-tight font-normal text-forest">¡Gracias por postularla!</b>
                <span className="text-sm">Envía el mensaje en WhatsApp. El equipo revisa cada postulación y contacta a la marca.</span>
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}
