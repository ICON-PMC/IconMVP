"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveBrandProfile, type BrandFormState } from "./actions";
import { BRAND_BIO_MAX, BRAND_NAME_MAX } from "@/lib/brand-registration";

type Props = {
  cities: { id: string; name: string }[];
  defaults: { name: string; bio: string; city: string; link: string };
};

const field = "glass-input h-11 rounded-xl px-4 text-base md:h-10 md:text-sm";

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} role="alert" className="mt-1 text-xs text-coral">
      {msg}
    </p>
  ) : null;
}

export function ProfileForm({ cities, defaults }: Props) {
  const [state, action, pending] = useActionState<BrandFormState, FormData>(
    saveBrandProfile,
    {},
  );
  const v = { ...defaults, ...state.values };
  const e = state.errors ?? {};
  const [bioLen, setBioLen] = useState(v.bio.length);
  const [city, setCity] = useState(v.city);
  const cityItems = cities.map((c) => ({ value: c.id, label: c.name }));

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message && (
        <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">{state.message}</p>
      )}

      <div>
        <Label htmlFor="name" className="mb-1 text-ink/60">
          Nombre comercial
        </Label>
        <Input
          id="name"
          name="name"
          className={field}
          defaultValue={v.name}
          maxLength={BRAND_NAME_MAX}
          aria-invalid={!!e.name}
          aria-describedby="name-err"
        />
        <FieldError id="name-err" msg={e.name} />
      </div>

      <div>
        <Label htmlFor="bio" className="mb-1 text-ink/60">
          Cuéntanos de tu marca
        </Label>
        <Textarea
          id="bio"
          name="bio"
          rows={3}
          className="glass-input min-h-24 resize-none rounded-xl px-4 py-2.5 text-base md:text-sm"
          defaultValue={v.bio}
          onChange={(ev) => setBioLen(ev.target.value.length)}
          aria-invalid={!!e.bio}
          aria-describedby="bio-err"
        />
        <div className="mt-1 flex justify-between gap-2">
          <FieldError id="bio-err" msg={e.bio} />
          <span
            className={`ml-auto text-xs ${bioLen > BRAND_BIO_MAX ? "text-coral" : "text-ink/40"}`}
          >
            {bioLen}/{BRAND_BIO_MAX}
          </span>
        </div>
      </div>

      <div>
        <Label htmlFor="city" className="mb-1 text-ink/60">
          Ciudad
        </Label>
        <Select name="city" value={city} onValueChange={(c) => setCity(c ?? "")} items={cityItems}>
          <SelectTrigger
            id="city"
            className={`${field} w-full`}
            aria-invalid={!!e.city}
            aria-describedby="city-err"
          >
            <SelectValue placeholder="Elige una ciudad" />
          </SelectTrigger>
          <SelectContent>
            {cityItems.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id="city-err" msg={e.city} />
      </div>

      <div>
        <Label htmlFor="link" className="mb-1 text-ink/60">
          Sitio web o WhatsApp
        </Label>
        <Input
          id="link"
          name="link"
          className={field}
          defaultValue={v.link}
          placeholder="tumarca.co o 300 123 4567"
          inputMode="url"
          autoCapitalize="none"
          aria-invalid={!!e.link}
          aria-describedby="link-err"
        />
        <FieldError id="link-err" msg={e.link} />
      </div>

      <Button
        type="submit"
        disabled={pending}
        size="lg" className="mt-1 rounded-xl bg-forest text-base text-white hover:bg-forest-deep md:text-sm"
      >
        {pending ? "Guardando…" : "Continuar"}
      </Button>
    </form>
  );
}
