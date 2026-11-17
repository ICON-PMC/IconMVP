"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setPrivacy } from "@/app/(app)/u/[handle]/actions";
import { cn } from "@/lib/utils";

function Switch({
  id,
  checked,
  disabled,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-label text-text">
          {label}
        </label>
        <p id={`${id}-desc`} className="mt-0.5 text-[13px] leading-5 text-text-muted">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-desc`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-line-strong disabled:opacity-50",
          checked ? "bg-surface-inverse" : "bg-line-strong",
        )}
      >
        <span className={cn("inline-block size-5 rounded-full bg-surface-raised shadow-sm transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
      </button>
    </div>
  );
}

/** Privacidad del perfil (spec 009, FR-014): se guarda al tocar cada interruptor. */
export function PrivacySection({ isPublic: initialPublic, showLikes: initialLikes }: { isPublic: boolean; showLikes: boolean }) {
  const [state, setState] = useState({ isPublic: initialPublic, showLikes: initialLikes });
  const [pending, startTransition] = useTransition();

  function save(next: typeof state) {
    const prev = state;
    setState(next);
    startTransition(async () => {
      const res = await setPrivacy(next);
      if (!res.ok) {
        setState(prev);
        toast.error(res.error);
      } else toast.success("Privacidad guardada.");
    });
  }

  return (
    <section id="privacidad" className="surface mt-6 scroll-mt-24 p-5 md:p-6">
      <h2 className="mb-4 text-h3 text-text">Privacidad</h2>
      <div className="flex flex-col gap-5">
        <Switch
          id="is_public"
          label="Perfil público"
          description={
            state.isPublic
              ? "Cualquier persona ve tu perfil: foto, nombre, bio, ciudad, enlace y tus looks."
              : "Nadie más ve tu perfil. Tus looks publicados siguen en el feed."
          }
          checked={state.isPublic}
          disabled={pending}
          onChange={(v) => save({ ...state, isPublic: v })}
        />
        <Switch
          id="show_likes"
          label="Mostrar lo que me gusta"
          description={
            state.showLikes
              ? "Tu perfil muestra las prendas y los looks que te gustan."
              : "Solo tú ves las prendas y los looks que te gustan."
          }
          checked={state.showLikes}
          disabled={pending || !state.isPublic}
          onChange={(v) => save({ ...state, showLikes: v })}
        />
        <p className="text-[13px] text-text-muted">Lo que guardas nunca se muestra en tu perfil.</p>
      </div>
    </section>
  );
}
