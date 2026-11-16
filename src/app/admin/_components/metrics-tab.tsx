import { SectionHeader } from "@/components/page-shell";

type Row = { id: string; name: string; clicks: number };

/** Datos de `user_look_stats()` (spec 008, US6). */
export type UserLookStats = {
  published: number;
  published_30d: number;
  authors: number;
  with_brand: number;
  brands_tagged: number;
  clicks: number;
  clicks_by_brand: { brand_id: string | null; name: string | null; clicks: number }[];
};

export function MetricsTab({
  totals,
  clicks,
  topBrands,
  topGarments,
  looks,
}: {
  totals: { brands: number; garments: number; posts: number };
  clicks: { total: number; last7d: number };
  topBrands: Row[];
  topGarments: Row[];
  looks?: UserLookStats | null;
}) {
  const tiles = [
    { label: "Marcas", value: totals.brands },
    { label: "Prendas", value: totals.garments },
    { label: "Posts", value: totals.posts },
  ];
  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-3 gap-3">
        {tiles.map((m) => (
          <li key={m.label}>
            <div className="surface px-3 py-4 text-center">
              <p className="text-2xl font-medium text-forest sm:text-3xl">{m.value}</p>
              <p className="text-[11px] uppercase tracking-wide text-ink/60">{m.label}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="surface p-5">
        <SectionHeader title="Clics a la tienda" />
        <div className="mt-4 mb-5 flex gap-10">
          <div>
            <p className="text-3xl font-medium text-coral">{clicks.total}</p>
            <p className="text-xs uppercase tracking-wide text-ink/60">Total</p>
          </div>
          <div>
            <p className="text-3xl font-medium text-coral">{clicks.last7d}</p>
            <p className="text-xs uppercase tracking-wide text-ink/60">Últimos 7 días</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <TopList title="Top marcas" rows={topBrands} />
          <TopList title="Top prendas" rows={topGarments} />
        </div>
      </div>

      {looks && (
        <div className="surface p-5">
          <SectionHeader title="Looks de usuarios" />
          {/* Criterio de salida de la Fase 1 del roadmap: 10 usuarios publicando y 3 marcas etiquetadas. */}
          <p className="mt-1 text-sm text-text-muted">
            Fase 1: {Math.min(looks.authors, 10)} de 10 usuarios · {Math.min(looks.brands_tagged, 3)} de 3 marcas
          </p>
          <ul className="mt-4 mb-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { label: "Publicados", value: looks.published },
              { label: "Últimos 30 días", value: looks.published_30d },
              { label: "Autores", value: looks.authors },
              { label: "Con marca", value: looks.with_brand },
              { label: "Clics a tiendas", value: looks.clicks },
            ].map((t) => (
              <li key={t.label}>
                <p className="text-3xl font-medium text-text">{t.value}</p>
                <p className="text-xs uppercase tracking-wide text-text-muted">{t.label}</p>
              </li>
            ))}
          </ul>
          <TopList
            title="Clics desde looks, por marca"
            rows={looks.clicks_by_brand.map((r) => ({ id: r.brand_id ?? "sin-marca", name: r.name ?? "Sin marca", clicks: r.clicks }))}
          />
        </div>
      )}
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/60">{title}</h3>
      {rows.length ? (
        <ol className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-2 text-sm">
              <span className="truncate text-ink/80">{r.name}</span>
              <span className="font-medium text-forest">{r.clicks}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink/50">Aún no hay clics.</p>
      )}
    </div>
  );
}
