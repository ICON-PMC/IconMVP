import { GlassCard } from "@/components/glass-card";
import { SectionHeader } from "@/components/page-shell";

type Row = { id: string; name: string; clicks: number };

export function MetricsTab({
  totals,
  clicks,
  topBrands,
  topGarments,
}: {
  totals: { brands: number; garments: number; posts: number };
  clicks: { total: number; last7d: number };
  topBrands: Row[];
  topGarments: Row[];
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
            <GlassCard className="px-3 py-4 text-center">
              <p className="text-2xl font-medium text-forest sm:text-3xl">{m.value}</p>
              <p className="text-[11px] uppercase tracking-wide text-ink/60">{m.label}</p>
            </GlassCard>
          </li>
        ))}
      </ul>

      <GlassCard className="p-5">
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
      </GlassCard>
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
