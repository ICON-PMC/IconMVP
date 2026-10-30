"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { startCatalogRun } from "./actions";

export type BrandOption = { id: string; name: string };

// Formulario para iniciar la lectura del catálogo de una marca (tienda en vivo o CSV).
export function RunForm({
  brands,
  hasDefaultContact,
  onStarted,
}: {
  brands: BrandOption[];
  hasDefaultContact: boolean;
  onStarted: (runId: string, warnings: string[]) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ message: string; useCsv: boolean } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const hasCsv = fd.get("csv") instanceof File && (fd.get("csv") as File).size > 0;
    if (!String(fd.get("url") ?? "").trim() && !hasCsv) {
      setError({ message: "Indica la dirección de la tienda o sube el CSV de productos.", useCsv: false });
      return;
    }
    start(async () => {
      try {
        const res = await startCatalogRun(fd);
        if (res.ok) onStarted(res.runId, res.warnings);
        else setError({ message: res.error, useCsv: res.hint === "use_csv" });
      } catch {
        setError({ message: "No se pudo iniciar. Revisa tu conexión e inténtalo de nuevo.", useCsv: false });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Marca" htmlFor="catalog-brand" hint="La marca ya debe existir en Icon.">
        <NativeSelect id="catalog-brand" name="brand_id" required defaultValue="">
          <option value="" disabled>
            Elige una marca…
          </option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Dirección de la tienda"
          htmlFor="catalog-url"
          hint="Tienda Shopify, por ejemplo https://tienda.com. Con CSV solo arma los enlaces de compra."
        >
          <Input id="catalog-url" name="url" type="text" inputMode="url" placeholder="https://tienda.com" autoComplete="off" />
        </FormField>
        <FormField
          label="CSV de productos (opcional)"
          htmlFor="catalog-csv"
          hint="Si la marca lo exportó de su admin de Shopify, no se lee la tienda."
        >
          <Input id="catalog-csv" name="csv" type="file" accept=".csv,text/csv" className="h-auto min-h-11 py-2" />
        </FormField>
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-white/40 px-3 py-3 text-sm text-ink">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-forest" />
        <span>
          <b>La marca autorizó el uso de su catálogo y de sus fotos.</b> Icon deja constancia de quién lo confirmó y cuándo.
        </span>
      </label>

      <details className="rounded-xl bg-white/30 px-3 py-2 text-sm" open={!hasDefaultContact}>
        <summary className="min-h-11 cursor-pointer py-2 text-ink/70">Opciones avanzadas</summary>
        <div className="mt-2 grid gap-4 pb-2 sm:grid-cols-2">
          <FormField
            label="Correo de contacto"
            htmlFor="catalog-contact"
            hint={
              hasDefaultContact
                ? "Opcional: por defecto se usa el correo del equipo. La tienda lo ve."
                : "Obligatorio: la tienda lo ve para saber quién lee su catálogo. Usa el correo del equipo."
            }
          >
            <Input id="catalog-contact" name="contact" type="email" required={!hasDefaultContact} autoComplete="off" />
          </FormField>
          <FormField label="Límite de prendas" htmlFor="catalog-max" hint="Útil para una primera prueba (por ejemplo, 5).">
            <Input id="catalog-max" name="max" type="number" min={1} step={1} inputMode="numeric" />
          </FormField>
          <FormField label="Pausa entre peticiones (ms)" htmlFor="catalog-pause" hint="Entre 1000 y 10000. Por defecto 2000.">
            <Input id="catalog-pause" name="pause_ms" type="number" min={1000} max={10000} step={500} inputMode="numeric" />
          </FormField>
          <label className="flex items-center gap-3 self-end text-sm text-ink">
            <input type="checkbox" name="skip_photos" className="size-5 shrink-0 accent-forest" />
            No descargar fotos (solo el Excel)
          </label>
        </div>
      </details>

      {error && (
        <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
          {error.message}
          {error.useCsv && " Sube el CSV de la marca en el campo de arriba y vuelve a intentarlo."}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full rounded-full sm:w-auto sm:px-6">
        {pending ? "Preparando…" : "Leer catálogo"}
      </Button>
    </form>
  );
}
