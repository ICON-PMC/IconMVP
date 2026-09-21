"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addOnboardingGarment, type GarmentFormState } from "./actions";

const field = "glass-input h-11 rounded-xl px-4 text-base md:h-10 md:text-sm";

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} role="alert" className="mt-1 text-xs text-coral">
      {msg}
    </p>
  ) : null;
}

export function GarmentForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<GarmentFormState, FormData>(
    addOnboardingGarment,
    {},
  );
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const [category, setCategory] = useState(v.category ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  // URL de blob solo para la vista previa local; a R2 se sube el archivo.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const items = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message && (
        <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">{state.message}</p>
      )}

      <div>
        <Label htmlFor="title" className="mb-1 text-ink/60">Nombre de la prenda</Label>
        <Input id="title" name="title" className={field} defaultValue={v.title} maxLength={100}
          aria-invalid={!!e.title} aria-describedby="title-err" />
        <FieldError id="title-err" msg={e.title} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
        <div>
          <Label htmlFor="price" className="mb-1 text-ink/60">Precio (COP)</Label>
          <Input id="price" name="price" className={field} defaultValue={v.price} inputMode="numeric"
            placeholder="120000" aria-invalid={!!e.price} aria-describedby="price-err" />
          <FieldError id="price-err" msg={e.price} />
        </div>
        <div>
          <Label htmlFor="category" className="mb-1 text-ink/60">Categoría</Label>
          <Select name="category" value={category} onValueChange={(c) => setCategory(c ?? "")} items={items}>
            <SelectTrigger id="category" className={`${field} w-full`} aria-invalid={!!e.category}
              aria-describedby="category-err">
              <SelectValue placeholder="Elige" />
            </SelectTrigger>
            <SelectContent>
              {items.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="category-err" msg={e.category} />
        </div>
      </div>

      <div>
        <Label htmlFor="link" className="mb-1 text-ink/60">Enlace de compra (opcional)</Label>
        <Input id="link" name="link" className={field} defaultValue={v.link} inputMode="url"
          autoCapitalize="none" placeholder="tumarca.co/producto" aria-invalid={!!e.link}
          aria-describedby="link-err" />
        <FieldError id="link-err" msg={e.link} />
      </div>

      <div>
        <Label htmlFor="image" className="mb-1 text-ink/60">Foto</Label>
        <Input id="image" name="image" type="file" accept="image/*" className="glass-input h-auto rounded-xl py-2"
          aria-invalid={!!e.photo} aria-describedby="photo-err"
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="Vista previa" className="mt-2 h-28 rounded-xl object-cover" />}
        <FieldError id="photo-err" msg={e.photo} />
      </div>

      <Button type="submit" disabled={pending}
        size="lg" className="rounded-xl bg-forest text-base text-white hover:bg-forest-deep md:text-sm">
        {pending ? "Guardando…" : "Guardar prenda"}
      </Button>
    </form>
  );
}
