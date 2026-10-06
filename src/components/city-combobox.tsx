"use client";

import { useMemo } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import type { CityOption } from "@/lib/cities";
import { cn } from "@/lib/utils";

// Sin acentos ni mayúsculas: "medellin" encuentra "Medellín", "bogota" encuentra "Bogotá".
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const matches = (item: CityOption, query: string) => norm(item.label).includes(norm(query.trim()));

// Con 1.122 municipios se pintan como máximo estos; escribir acota el resto.
const LIMIT = 50;

const inputGroup =
  "glass-input relative flex min-h-11 w-full items-center rounded-xl pr-16 md:min-h-10 focus-within:ring-3 focus-within:ring-ring/50";
const input =
  "h-11 w-full min-w-24 flex-1 bg-transparent px-4 text-base text-ink outline-none placeholder:text-ink/40 md:h-10 md:text-sm";

function Popup({ empty }: { empty: string }) {
  return (
    <Combobox.Portal>
      <Combobox.Positioner className="z-50 outline-none" sideOffset={4}>
        <Combobox.Popup className="w-[var(--anchor-width)] max-w-[var(--available-width)] overflow-hidden rounded-xl border border-black/5 bg-white/95 text-ink shadow-lg backdrop-blur">
          <Combobox.Empty>
            <p className="px-4 py-3 text-sm text-ink/50">{empty}</p>
          </Combobox.Empty>
          <Combobox.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto overscroll-contain py-1 outline-0 data-empty:p-0">
            {(item: CityOption) => (
              <Combobox.Item
                key={item.value}
                value={item}
                className="grid min-h-11 cursor-default grid-cols-[1rem_1fr] items-center gap-2 px-3 text-sm outline-none select-none data-highlighted:bg-forest/10 md:min-h-9"
              >
                <Combobox.ItemIndicator className="col-start-1 text-forest">
                  <CheckIcon className="size-4" />
                </Combobox.ItemIndicator>
                <span className="col-start-2">{item.label}</span>
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}

/**
 * Desplegable con búsqueda para elegir una ciudad dentro de un `<form>`: envía el `value`
 * (id de la ciudad) con el nombre de campo `name`.
 */
export function CityCombobox({
  id,
  name,
  options,
  defaultValue,
  placeholder = "Escribe tu ciudad",
  invalid,
  describedBy,
}: {
  id?: string;
  name: string;
  options: CityOption[];
  defaultValue?: string | null;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const initial = useMemo(
    () => options.find((o) => o.value === defaultValue) ?? null,
    [options, defaultValue],
  );
  return (
    <Combobox.Root
      items={options}
      name={name}
      defaultValue={initial}
      filter={matches}
      limit={LIMIT}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <Combobox.InputGroup className={inputGroup}>
        <Combobox.Input
          id={id}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={input}
        />
        <div className="absolute right-1 flex h-full items-center text-ink/50">
          <Combobox.Clear aria-label="Quitar ciudad" className="flex size-8 items-center justify-center">
            <XIcon className="size-4" />
          </Combobox.Clear>
          <Combobox.Trigger aria-label="Ver ciudades" className="flex size-8 items-center justify-center">
            <ChevronDownIcon className="size-4" />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>
      <Popup empty="No encontramos esa ciudad." />
    </Combobox.Root>
  );
}

/** Selección múltiple controlada (filtro de ciudad del feed). Trabaja con `value` (slugs). */
export function CityMultiCombobox({
  options,
  value,
  onValueChange,
  label,
  className,
}: {
  options: CityOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  label: string;
  className?: string;
}) {
  const selected = useMemo(() => options.filter((o) => value.includes(o.value)), [options, value]);
  return (
    <Combobox.Root
      items={options}
      multiple
      value={selected}
      onValueChange={(v) => onValueChange(v.map((o) => o.value))}
      filter={matches}
      limit={LIMIT}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <Combobox.InputGroup className={cn(inputGroup, "flex-wrap gap-1 py-1 pl-1", className)}>
        <Combobox.Chips className="contents">
          {selected.map((c) => (
            <Combobox.Chip
              key={c.value}
              className="flex items-center gap-1 rounded-full bg-forest px-2.5 py-1 text-xs font-medium text-white"
            >
              {c.label}
              <Combobox.ChipRemove aria-label={`Quitar ${c.label}`} className="rounded-full">
                <XIcon className="size-3" />
              </Combobox.ChipRemove>
            </Combobox.Chip>
          ))}
        </Combobox.Chips>
        <Combobox.Input
          aria-label={label}
          placeholder={selected.length ? "" : "Busca una ciudad"}
          className={cn(input, "h-9 px-3 md:h-8")}
        />
        <div className="absolute right-1 flex h-full items-center text-ink/50">
          <Combobox.Trigger aria-label="Ver ciudades" className="flex size-8 items-center justify-center">
            <ChevronDownIcon className="size-4" />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>
      <Popup empty="No hay marcas en esa ciudad todavía." />
    </Combobox.Root>
  );
}
