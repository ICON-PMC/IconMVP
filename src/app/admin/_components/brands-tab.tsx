"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SearchIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { TypeToConfirmDialog } from "@/components/type-to-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { deleteBrandAsStaff, setBrandFlags, startManagingBrand } from "../actions";

export type AdminBrand = {
  id: string;
  name: string;
  slug: string;
  status: "pending" | "active" | "rejected";
  is_active: boolean;
  is_verified: boolean;
  is_sustainable: boolean;
  city: string | null;
  garments: number;
  looks: number;
  hasOwner: boolean;
};

const STATUS_LABEL: Record<AdminBrand["status"], string> = {
  pending: "Pendiente",
  active: "Aprobada",
  rejected: "Rechazada",
};

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "active", label: "Aprobadas" },
  { id: "pending", label: "Pendientes" },
  { id: "rejected", label: "Rechazadas" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const FLAGS = [
  { key: "is_active", label: "Activa" },
  { key: "is_verified", label: "Verificada" },
  { key: "is_sustainable", label: "Sostenible" },
] as const;

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Todas las marcas: buscar, filtrar por estado, activar/verificar/sostenible, gestionar (abre su
 * panel) y eliminar. Las pendientes de aprobación se revisan en la pestaña "Pendientes".
 */
export function BrandsTab({ brands }: { brands: AdminBrand[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<AdminBrand | null>(null);
  const [pending, start] = useTransition();

  const visible = useMemo(() => {
    const q = norm(query.trim());
    return brands.filter(
      (b) => (filter === "all" || b.status === filter) && (!q || norm(`${b.name} ${b.city ?? ""}`).includes(q)),
    );
  }, [brands, query, filter]);

  function toggle(b: AdminBrand, key: (typeof FLAGS)[number]["key"], value: boolean) {
    start(async () => {
      const r = await setBrandFlags(b.id, { [key]: value });
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/40"
        />
        <Input
          type="search"
          aria-label="Buscar marca"
          placeholder="Buscar por nombre o ciudad"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
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

      {visible.length ? (
        <ul className="flex flex-col gap-2">
          {visible.map((b) => (
            <li key={b.id} className="glass-input rounded-2xl p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link href={`/marca/${b.slug}`} className="font-medium text-forest hover:underline">
                  {b.name}
                </Link>
                <span className="text-xs text-ink/60">
                  {STATUS_LABEL[b.status]} · {b.garments} {b.garments === 1 ? "prenda" : "prendas"} ·{" "}
                  {b.looks} {b.looks === 1 ? "look" : "looks"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink/50">
                {b.city ?? "Sin ciudad"}
                {!b.hasOwner && " · cargada por el equipo"}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {FLAGS.map((f) => (
                  <label key={f.key} className="flex min-h-9 items-center gap-2 text-sm text-ink/80">
                    <Checkbox
                      checked={b[f.key]}
                      disabled={pending}
                      onCheckedChange={(v) => toggle(b, f.key, v === true)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={startManagingBrand.bind(null, b.id)}>
                  <Button type="submit" variant="outline" size="sm" className="rounded-full">
                    Gestionar
                  </Button>
                </form>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleting(b)}
                  className="rounded-full text-coral"
                >
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={brands.length ? "Ninguna marca coincide" : "Aún no hay marcas"}
          description={brands.length ? "Prueba con otro filtro o búsqueda." : undefined}
        />
      )}

      <TypeToConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`¿Eliminar ${deleting?.name ?? ""}?`}
        description={
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-left">
            <li>Se borran su catálogo, sus looks y sus fotos.</li>
            <li>Si tiene dueño, su cuenta sigue activa como usuario.</li>
            <li>Las métricas de clics quedan, sin el nombre de la marca.</li>
          </ul>
        }
        phrase={deleting?.name ?? ""}
        confirmLabel="Eliminar marca"
        pending={pending}
        onConfirm={(typed) =>
          deleting &&
          start(async () => {
            const r = await deleteBrandAsStaff(deleting.id, typed);
            if (!r.ok) return void toast.error(r.error);
            toast.success(`Eliminamos ${deleting.name}.`);
            setDeleting(null);
            router.refresh();
          })
        }
      />
    </div>
  );
}
