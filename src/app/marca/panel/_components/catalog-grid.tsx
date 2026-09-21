"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { StickyActionBar } from "@/components/sticky-action-bar";
import { imageUrl } from "@/lib/images";
import { formatCop } from "@/lib/taxonomy";
import { useSelection } from "@/lib/use-selection";
import { cn } from "@/lib/utils";
import { deleteGarments, setGarmentsStatus, type BulkResult } from "../actions";

export type CatalogGarment = {
  id: string;
  title: string;
  price_cop: number | null;
  status: string;
  cf_image_id: string | null;
};

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "published", label: "Publicadas" },
  { id: "pending", label: "Pendientes" },
  { id: "archived", label: "Archivadas" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function CatalogGrid({
  garments,
  canPublish,
}: {
  garments: CatalogGarment[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selecting, setSelecting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const visible = useMemo(() => {
    const q = norm(query.trim());
    return garments.filter(
      (g) => (filter === "all" || g.status === filter) && (!q || norm(g.title).includes(q)),
    );
  }, [garments, query, filter]);

  const sel = useSelection(useMemo(() => visible.map((g) => g.id), [visible]));

  function exitSelection() {
    sel.clear();
    setSelecting(false);
  }

  function report(r: BulkResult, verb: string) {
    if (!r.ok) return void toast.error(r.error);
    const n = `${r.done} de ${r.done + r.skipped}`;
    if (r.skipped) toast.warning(`${verb}: ${n}. Algunas no se pudieron modificar.`);
    else toast.success(`${verb}: ${n}.`);
    exitSelection();
    router.refresh();
  }

  const ids = () => [...sel.selected];
  const run = (fn: () => Promise<BulkResult>, verb: string) =>
    start(async () => report(await fn(), verb));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/40"
          />
          <Input
            type="search"
            aria-label="Buscar prenda"
            placeholder="Buscar prenda"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant={selecting ? "secondary" : "outline"}
          onClick={() => (selecting ? exitSelection() : setSelecting(true))}
          className="rounded-full"
        >
          {selecting ? "Listo" : "Seleccionar"}
        </Button>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ToggleGroup
          aria-label="Filtrar por estado"
          value={[filter]}
          onValueChange={(v) => v[0] && setFilter(v[0] as Filter)}
          spacing={1}
          className="min-w-max"
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem
              key={f.id}
              value={f.id}
              className="min-h-11 rounded-full px-4 md:min-h-8 data-[pressed]:bg-forest data-[pressed]:text-white"
            >
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {selecting && visible.length > 0 && (
        <div className="flex items-center justify-between text-sm text-ink/70">
          <span>{sel.count ? "Elige lo que quieras cambiar" : "Toca las prendas para elegirlas"}</span>
          <Button
            type="button"
            variant="ghost"
            onClick={sel.allSelected ? sel.clear : sel.selectAll}
            className="rounded-full"
          >
            {sel.allSelected ? "Quitar selección" : "Seleccionar todas"}
          </Button>
        </div>
      )}

      {visible.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((g) => (
            <GarmentTile
              key={g.id}
              g={g}
              selecting={selecting}
              selected={sel.isSelected(g.id)}
              onToggle={() => sel.toggle(g.id)}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          title={garments.length ? "Ninguna prenda coincide" : "Tu catálogo está vacío"}
          description={
            garments.length
              ? "Prueba con otro filtro o búsqueda."
              : "Agrega tu primera prenda para poder taggearla en un look."
          }
        />
      )}

      {selecting && sel.count > 0 && (
        <StickyActionBar
          label={`${sel.count} ${sel.count === 1 ? "seleccionada" : "seleccionadas"}`}
        >
          <Button
            type="button"
            disabled={pending || !canPublish}
            title={canPublish ? undefined : "Podrás publicar cuando tu marca sea aprobada."}
            onClick={() => run(() => setGarmentsStatus(ids(), "published"), "Publicadas")}
            className="rounded-full"
          >
            Publicar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => setGarmentsStatus(ids(), "archived"), "Archivadas")}
            className="rounded-full"
          >
            Archivar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
            className="rounded-full"
          >
            Eliminar
          </Button>
        </StickyActionBar>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Eliminar ${sel.count} ${sel.count === 1 ? "prenda" : "prendas"}?`}
        description="Se quitan también de los looks donde estén taggeadas; un look publicado que se quede sin prendas vuelve a borrador. No se puede deshacer."
        onConfirm={() => run(() => deleteGarments(ids()), "Eliminadas")}
      />
    </div>
  );
}

function GarmentTile({
  g,
  selecting,
  selected,
  onToggle,
}: {
  g: CatalogGarment;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const img = imageUrl(g.cf_image_id);
  const body = (
    <>
      <div className="relative mb-2">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="aspect-square w-full rounded-xl object-cover" />
        ) : (
          <div className="aspect-square w-full rounded-xl bg-ink/5" aria-hidden />
        )}
        {selecting && (
          <span
            aria-hidden
            className={cn(
              "absolute top-2 right-2 flex size-7 items-center justify-center rounded-full border",
              selected ? "border-forest bg-forest text-white" : "border-white/80 bg-white/70 text-transparent",
            )}
          >
            <CheckIcon className="size-4" />
          </span>
        )}
      </div>
      <p className="truncate text-sm font-medium text-ink">{g.title}</p>
      <div className="mt-1 flex items-center justify-between gap-1">
        <span className="text-xs text-ink/60">
          {g.price_cop != null ? formatCop(g.price_cop) : "Sin precio"}
        </span>
        <StatusBadge status={g.status} />
      </div>
    </>
  );

  return (
    <li>
      {selecting ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={g.title}
          onClick={onToggle}
          className={cn(
            "glass-input block w-full rounded-2xl border-2 p-2 text-left focus-visible:ring-3 focus-visible:ring-ring/50",
            selected ? "!border-forest" : "border-transparent",
          )}
        >
          {body}
        </button>
      ) : (
        <div className="glass-input rounded-2xl p-2">{body}</div>
      )}
    </li>
  );
}
