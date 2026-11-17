"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CircleAlertIcon, LoaderIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkHandle } from "@/app/(app)/u/[handle]/actions";
import { normalizeHandleInput } from "@/lib/profile-rules";

type Check = { value: string; available: boolean; reason: string | null };

/**
 * Nombre de usuario con disponibilidad en vivo (spec 009, FR-011): minúsculas mientras se escribe,
 * consulta con espera de 400 ms y muestra la dirección resultante.
 */
export function HandleField({
  defaultValue,
  name = "handle",
  id = "handle",
  error,
}: {
  defaultValue: string;
  name?: string;
  id?: string;
  /** Error que devolvió el servidor al guardar. */
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [check, setCheck] = useState<Check | null>(null);

  useEffect(() => {
    if (value === defaultValue || !value) return;
    let alive = true;
    const t = setTimeout(() => {
      checkHandle(value).then((r) => alive && setCheck({ value, ...r }));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [value, defaultValue]);

  const unchanged = value === defaultValue;
  const current = check?.value === value ? check : null;
  const pending = !unchanged && !!value && !current;
  const shownError = error && unchanged ? error : !unchanged && current && !current.available ? current.reason : error;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-label text-text">
        Nombre de usuario
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" aria-hidden>
          @
        </span>
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(e) => setValue(normalizeHandleInput(e.target.value))}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          maxLength={24}
          className="pl-7"
          aria-invalid={shownError ? true : undefined}
          aria-describedby={`${id}-status`}
        />
      </div>
      <p id={`${id}-status`} aria-live="polite" className="flex min-h-5 items-center gap-1.5 text-[13px]">
        {shownError ? (
          <span className="flex items-center gap-1.5 text-danger">
            <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden /> {shownError}
          </span>
        ) : pending ? (
          <span className="flex items-center gap-1.5 text-text-muted">
            <LoaderIcon className="size-3.5 animate-spin" aria-hidden /> Revisando…
          </span>
        ) : !unchanged && current?.available ? (
          <span className="flex items-center gap-1.5 font-medium text-success">
            <CheckIcon className="size-3.5" aria-hidden /> Disponible
          </span>
        ) : null}
      </p>
      <p className="text-[13px] text-text-muted">
        Tu perfil: iconcolombia.com/u/<span className="font-medium text-text">{value || "…"}</span>
      </p>
    </div>
  );
}
