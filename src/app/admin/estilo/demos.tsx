"use client";

import { useState } from "react";
import { HeartIcon, SearchIcon, ShoppingBagIcon } from "lucide-react";
import { Chip } from "@/components/chip";
import { FormField } from "@/components/form-field";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Partes interactivas de la guía de estilo (spec 007).

export function ButtonDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Ir a la tienda</Button>
      <Button variant="secondary">Guardar</Button>
      <Button variant="inverse">Seguir</Button>
      <Button variant="ghost">Cancelar</Button>
      <Button variant="danger">Eliminar</Button>
      <Button variant="link">Ver más</Button>
      <Button size="lg">
        <ShoppingBagIcon data-icon="inline-start" /> Grande
      </Button>
      <Button size="sm">Pequeño</Button>
      <Button size="icon" variant="secondary" aria-label="Me gusta">
        <HeartIcon />
      </Button>
      <Button disabled>Deshabilitado</Button>
      <Button
        loading={loading}
        onClick={() => {
          setLoading(true);
          setTimeout(() => setLoading(false), 1500);
        }}
      >
        {loading ? "Publicando…" : "Probar cargando"}
      </Button>
    </div>
  );
}

const STYLES = ["Minimalista", "Urbano", "Old money", "Kawaii", "Tropical"];

export function ChipDemo() {
  const [on, setOn] = useState<string[]>(["Urbano"]);
  const [tags, setTags] = useState(["Medellín", "Fiesta", "Hasta $200.000"]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {STYLES.map((s, i) => (
          <Chip
            key={s}
            selected={on.includes(s)}
            count={[12, 155, 8, 3, 21][i]}
            onClick={() => setOn((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}
          >
            {s}
          </Chip>
        ))}
        <Chip disabled>Sin resultados</Chip>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <Chip key={t} selected onRemove={() => setTags((p) => p.filter((x) => x !== t))}>
            {t}
          </Chip>
        ))}
        {tags.length === 0 && (
          <Button variant="link" onClick={() => setTags(["Medellín", "Fiesta", "Hasta $200.000"])}>
            Restaurar
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip variant="tag">Casual</Chip>
        <Chip variant="tag">Algodón</Chip>
      </div>
      <div className="surface-inverse flex flex-wrap gap-2 p-4">
        <Chip variant="on-dark">Streetwear</Chip>
        <Chip variant="on-dark" selected>
          Brunch
        </Chip>
      </div>
    </div>
  );
}

export function FieldDemo() {
  const [value, setValue] = useState("");
  const error = value && value.length < 3 ? "Usa al menos 3 caracteres." : undefined;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Nombre de la prenda" htmlFor="demo-name" hint="Como aparece en tu tienda." error={error}>
        <Input
          id="demo-name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Camisa de lino"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "demo-name-error" : "demo-name-hint"}
        />
      </FormField>
      <FormField label="Buscar" htmlFor="demo-search">
        <div className="field flex items-center gap-2 px-3">
          <SearchIcon className="size-4 text-text-muted" aria-hidden />
          <input id="demo-search" className="h-11 flex-1 bg-transparent outline-none" placeholder="Prendas, outfits, marcas" />
        </div>
      </FormField>
      <FormField label="Deshabilitado" htmlFor="demo-off">
        <Input id="demo-off" disabled value="No editable" readOnly />
      </FormField>
    </div>
  );
}

export function SheetDemo() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir filtros
      </Button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Filtros"
        description="Así se ven los filtros en el celular."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setSel([])}>
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>
              Ver {48 - sel.length * 7} resultados
            </Button>
          </div>
        }
      >
        <p className="mb-2 text-label">Estilo</p>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <Chip
              key={s}
              selected={sel.includes(s)}
              onClick={() => setSel((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}
            >
              {s}
            </Chip>
          ))}
        </div>
      </ResponsiveSheet>
    </>
  );
}
