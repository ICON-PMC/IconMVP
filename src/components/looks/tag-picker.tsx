"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { BadgeCheckIcon, CheckIcon, PlusIcon, SearchIcon, ShirtIcon, StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { R2Image } from "@/components/r2-image";
import { Chip } from "@/components/chip";
import { Field } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCop } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import {
  createProposedGarment,
  mentionBrand,
  searchBrandsForLook,
  searchGarmentsForLook,
  tagGarment,
  type BrandResult,
  type GarmentResult,
} from "@/app/(app)/crear/actions";

type Option = { id: string; name: string };
type ColorOption = { id: string; name: string; hex: string | null };
type Tab = "prendas" | "marcas" | "crear";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Búsqueda remota con espera: devuelve los resultados de `q` (o null mientras no hay consulta válida
 * o no llegó la respuesta). El estado solo se escribe al llegar la respuesta.
 */
function useRemoteSearch<T>(q: string, run: (q: string) => Promise<T[]>, enabled: boolean): T[] | null {
  const [state, setState] = useState<{ q: string; results: T[] } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    run(q).then((results) => alive && setState({ q, results }));
    return () => {
      alive = false;
    };
  }, [q, run, enabled]);
  return enabled && state?.q === q ? state.results : null;
}

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Selector de etiquetas del look (spec 008, contracts §7): hoja con pestañas "Prendas", "Marcas" y
 * "Crear prenda". Búsquedas con espera de 300 ms. Cada elección se guarda al momento.
 */
export function TagPicker({
  postId,
  categories,
  colors,
  open,
  onOpenChange,
  taggedGarmentIds,
  full,
}: {
  postId: string;
  categories: Option[];
  colors: ColorOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taggedGarmentIds: string[];
  /** Ya hay 10 etiquetas. */
  full: boolean;
}) {
  const [tab, setTab] = useState<Tab>("prendas");
  const [draftName, setDraftName] = useState("");
  const tabsId = useId();

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Etiquetar"
      description={full ? "Llegaste a 10 etiquetas. Quita una para agregar otra." : "Prendas de Icon, marcas o una prenda nueva."}
    >
      <div role="tablist" aria-label="Qué etiquetar" className="mb-4 flex gap-1 rounded-full bg-surface-sunken p-1">
        {(
          [
            ["prendas", "Prendas"],
            ["marcas", "Marcas"],
            ["crear", "Crear prenda"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${tabsId}-${id}`}
            aria-selected={tab === id}
            aria-controls={`${tabsId}-${id}-panel`}
            onClick={() => setTab(id)}
            className={cn(
              "h-9 flex-1 rounded-full text-label transition-colors focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:outline-none",
              tab === id ? "bg-surface-raised text-text shadow-sm" : "text-text-muted hover:text-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${tabsId}-${tab}-panel`} aria-labelledby={`${tabsId}-${tab}`}>
        {tab === "prendas" && (
          <GarmentsTab
            postId={postId}
            disabled={full}
            tagged={taggedGarmentIds}
            onNotFound={(text) => {
              setDraftName(text);
              setTab("crear");
            }}
          />
        )}
        {tab === "marcas" && <BrandsTab postId={postId} disabled={full} />}
        {tab === "crear" && (
          <CreateGarmentTab
            postId={postId}
            disabled={full}
            categories={categories}
            colors={colors}
            initialName={draftName}
            onDone={() => onOpenChange(false)}
          />
        )}
      </div>
    </ResponsiveSheet>
  );
}

function SearchInput({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
      <Input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </label>
  );
}

function GarmentsTab({
  postId,
  disabled,
  tagged,
  onNotFound,
}: {
  postId: string;
  disabled: boolean;
  tagged: string[];
  onNotFound: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const results = useRemoteSearch<GarmentResult>(q, searchGarmentsForLook, q.trim().length >= 2);
  const [done, setDone] = useState<string[]>(tagged);
  const [pending, startTransition] = useTransition();

  function add(g: GarmentResult) {
    startTransition(async () => {
      const res = await tagGarment(postId, g.id);
      if (!res.ok) return void toast.error(res.error);
      setDone((d) => [...d, g.id]);
      toast.success(`Etiquetaste ${g.title}.`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={query} onChange={setQuery} label="Buscar prenda" placeholder="Busca por nombre, marca o color" />
      {results === null ? (
        <p className="py-6 text-center text-sm text-text-muted">Escribe al menos 2 letras para buscar en el catálogo.</p>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-text">No encontramos &ldquo;{q.trim()}&rdquo; en Icon.</p>
          <Button variant="secondary" onClick={() => onNotFound(q.trim())}>
            No la encuentro
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label="Resultados">
            {results.map((g) => {
              const isTagged = done.includes(g.id);
              return (
                <li key={g.id} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface-raised p-2 ring-1 ring-line">
                  <div className="size-14 shrink-0 overflow-hidden rounded-[var(--radius-field)] bg-surface-sunken">
                    <R2Image image={g.image} alt="" sizes="56px" className="size-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">{g.title}</p>
                    <p className="truncate text-[13px] text-text-muted">
                      {g.brandName}
                      {g.priceCop != null && ` · ${formatCop(g.priceCop)}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isTagged ? "ghost" : "secondary"}
                    disabled={isTagged || disabled || pending}
                    onClick={() => add(g)}
                    aria-label={isTagged ? `${g.title} ya está etiquetada` : `Etiquetar ${g.title}`}
                  >
                    {isTagged ? <CheckIcon /> : <PlusIcon />}
                    {isTagged ? "Lista" : "Etiquetar"}
                  </Button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => onNotFound(q.trim())} className="w-fit self-center text-sm font-medium text-action-text hover:underline">
            ¿No está? Créala
          </button>
        </>
      )}
    </div>
  );
}

function BrandsTab({ postId, disabled }: { postId: string; disabled: boolean }) {
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const results = useRemoteSearch<BrandResult>(q, searchBrandsForLook, q.trim().length > 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const exact = results?.some((r) => fold(r.name) === fold(q));

  function add(ref: { brandId: string } | { stubId: string } | { name: string }, label: string) {
    setError(null);
    startTransition(async () => {
      const res = await mentionBrand(postId, ref);
      if (!res.ok) return void setError(res.error);
      toast.success(`Mencionaste a ${label}.`);
      setQuery("");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={query} onChange={setQuery} label="Buscar marca" placeholder="Nombre de la marca" />
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {results === null ? (
        <p className="py-6 text-center text-sm text-text-muted">
          Menciona una marca de Icon o una que todavía no esté. Si llega a Icon, tu look queda conectado.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Marcas">
          {results.map((b) => (
            <li key={`${b.kind}-${b.id}`} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface-raised p-3 ring-1 ring-line">
              <StoreIcon className="size-4 shrink-0 text-text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{b.name}</p>
                {b.kind === "brand" ? (
                  <Badge variant="verified" className="mt-0.5">
                    <BadgeCheckIcon data-icon="inline-start" /> En Icon
                  </Badge>
                ) : (
                  <p className="text-[13px] text-text-muted">Aún no está en Icon</p>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled || pending}
                onClick={() => add(b.kind === "brand" ? { brandId: b.id } : { stubId: b.id }, b.name)}
              >
                <PlusIcon /> Mencionar
              </Button>
            </li>
          ))}
          {!exact && q.trim().length >= 2 && (
            <li>
              <Button variant="secondary" className="w-full" disabled={disabled || pending} onClick={() => add({ name: q.trim() }, q.trim())}>
                <PlusIcon data-icon="inline-start" /> Agregar &ldquo;{q.trim()}&rdquo;
              </Button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function CreateGarmentTab({
  postId,
  disabled,
  categories,
  colors,
  initialName,
  onDone,
}: {
  postId: string;
  disabled: boolean;
  categories: Option[];
  colors: ColorOption[];
  initialName: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [colorIds, setColorIds] = useState<string[]>([]);
  const [brandQuery, setBrandQuery] = useState("");
  const bq = useDebounced(brandQuery);
  const [brand, setBrand] = useState<{ ref: { brandId: string } | { stubId: string } | { name: string }; label: string } | null>(null);
  const brandResults = useRemoteSearch<BrandResult>(bq, searchBrandsForLook, !brand && bq.trim().length > 0) ?? [];
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameId = useId();

  function toggleColor(id: string) {
    setColorIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));
  }

  function submit() {
    setError(null);
    if (name.trim().length < 3) return setError("Escribe un nombre de al menos 3 letras.");
    if (!categoryId) return setError("Elige una categoría.");
    startTransition(async () => {
      const res = await createProposedGarment(postId, { name, categoryId, colorIds, brand: brand?.ref ?? null });
      if (!res.ok) return void setError(res.error);
      toast.success("Agregaste la prenda. Queda sin verificar hasta que una marca o el equipo la revise.");
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-muted">
        Para prendas que no están en el catálogo. Se muestran con la etiqueta &ldquo;Sin verificar&rdquo;.
      </p>
      <Field label="Nombre" htmlFor={nameId}>
        <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ej.: Camisa de lino blanca" />
      </Field>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-label text-text">Categoría</legend>
        <div className="flex flex-wrap gap-x-2">
          {categories.map((c) => (
            <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-label text-text">
          Colores <span className="font-normal text-text-muted">(hasta 3, opcional)</span>
        </legend>
        <div className="flex flex-wrap gap-x-2">
          {colors.map((c) => (
            <Chip key={c.id} selected={colorIds.includes(c.id)} onClick={() => toggleColor(c.id)}>
              {c.hex && <span className="size-3.5 rounded-full ring-1 ring-black/15" style={{ background: c.hex }} aria-hidden />}
              {c.name}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-text">
          Marca <span className="font-normal text-text-muted">(opcional)</span>
        </span>
        {brand ? (
          <Chip onRemove={() => setBrand(null)}>{brand.label}</Chip>
        ) : (
          <>
            <SearchInputPlain value={brandQuery} onChange={setBrandQuery} />
            {(brandResults.length > 0 || bq.trim().length >= 2) && (
              <ul className="flex flex-col gap-1">
                {brandResults.map((b) => (
                  <li key={`${b.kind}-${b.id}`}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-field)] px-3 text-left text-sm hover:bg-surface-sunken"
                      onClick={() => setBrand({ ref: b.kind === "brand" ? { brandId: b.id } : { stubId: b.id }, label: b.name })}
                    >
                      <span className="truncate font-medium text-text">{b.name}</span>
                      <span className="text-[13px] text-text-muted">{b.kind === "brand" ? "En Icon" : "Aún no está en Icon"}</span>
                    </button>
                  </li>
                ))}
                {!brandResults.some((b) => fold(b.name) === fold(bq)) && bq.trim().length >= 2 && (
                  <li>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-field)] px-3 text-left text-sm font-medium text-action-text hover:bg-surface-sunken"
                      onClick={() => setBrand({ ref: { name: bq.trim() }, label: bq.trim() })}
                    >
                      <PlusIcon className="size-4" aria-hidden /> Usar &ldquo;{bq.trim()}&rdquo;
                    </button>
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button size="lg" onClick={submit} loading={pending} disabled={disabled || pending}>
        <ShirtIcon data-icon="inline-start" /> Agregar prenda
      </Button>
    </div>
  );
}

function SearchInputPlain({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative block">
      <span className="sr-only">Buscar marca de la prenda</span>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Buscar marca" className="pl-9" />
    </label>
  );
}
