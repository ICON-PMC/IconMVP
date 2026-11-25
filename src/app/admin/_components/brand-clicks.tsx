import Link from "next/link";
import { SectionHeader } from "@/components/page-shell";
import { LinkTabs } from "@/components/link-tabs";
import { CLICK_PERIODS, type ClickStats } from "@/lib/click-stats";

const pct = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });

function href(period: string, slug?: string | null) {
  return `/admin?tab=metricas&clics=${period}${slug ? `&marca=${encodeURIComponent(slug)}` : ""}#clics`;
}

/**
 * Clics a la tienda por marca y, al elegir una, por prenda: un estimado de qué prendas se mueven.
 * Los clics automáticos (robots) se excluyen del estimado y se muestran aparte.
 */
export function BrandClicks({ stats }: { stats: ClickStats }) {
  const { period, totals, brands, brand } = stats;
  const max = Math.max(1, ...(brand?.garments.map((g) => g.clicks) ?? [0]));
  return (
    <section id="clics" className="surface scroll-mt-24 p-5">
      <SectionHeader title="Clics por tienda" />
      <p className="mt-1 text-sm text-text-muted">
        Cuántas veces la gente tocó &ldquo;Ir a la tienda&rdquo;. Es un estimado de interés, no de ventas.
      </p>
      <LinkTabs
        label="Periodo"
        size="sm"
        active={period}
        className="mt-4"
        tabs={CLICK_PERIODS.map((p) => ({ id: p.id, label: p.label, href: href(p.id, brand?.slug) }))}
      />
      <p className="mt-3 text-sm text-text">
        <strong className="text-h3">{totals.clicks}</strong> clics de personas
        {totals.automated > 0 && (
          <span className="text-text-muted"> · {totals.automated} automáticos excluidos (robots)</span>
        )}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0">
          <h3 className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">Marcas</h3>
          {brands.length ? (
            <ul className="flex flex-col">
              {brands.map((b) => (
                <li key={b.brandId}>
                  <Link
                    href={href(period, b.slug)}
                    aria-current={brand?.id === b.brandId ? "true" : undefined}
                    className={`flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-field)] px-3 text-sm hover:bg-surface-sunken ${brand?.id === b.brandId ? "bg-surface-sunken font-semibold" : ""}`}
                  >
                    <span className="truncate text-text">{b.name}</span>
                    <span className="shrink-0 tabular-nums text-text">{b.clicks}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No hay clics en este periodo.</p>
          )}
        </div>

        <div className="min-w-0">
          {brand ? (
            <>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-h3 text-text">{brand.name}</h3>
                <Link href={`/marca/${brand.slug}`} target="_blank" className="text-sm font-semibold text-action-text hover:underline">
                  Ver página
                </Link>
              </div>
              <p className="mb-3 text-sm text-text-muted">
                {brand.clicks} clics de personas
                {brand.raw > brand.clicks && ` (${brand.raw - brand.clicks} automáticos excluidos)`}
                {brand.noClicks > 0 && ` · ${brand.noClicks} prendas publicadas sin clics`}
              </p>
              {brand.garments.length ? (
                <ol className="flex flex-col gap-2">
                  {brand.garments.map((g, i) => (
                    <li key={g.garmentId} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <Link href={`/prenda/${g.garmentId}`} target="_blank" className="min-w-0 truncate text-text hover:underline">
                          <span className="mr-1.5 tabular-nums text-text-muted">{i + 1}.</span>
                          {g.title}
                        </Link>
                        <span className="shrink-0 tabular-nums text-text">
                          <strong>{g.clicks}</strong> <span className="text-text-muted">· {pct.format(g.share)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                          <span className="block h-full rounded-full bg-action" style={{ width: `${(g.clicks / max) * 100}%` }} />
                        </span>
                        {g.lastAt && <span className="w-14 shrink-0 text-right text-[11px] text-text-muted">{day.format(new Date(g.lastAt))}</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-text-muted">Ninguna prenda de esta marca tuvo clics en este periodo.</p>
              )}
            </>
          ) : (
            <p className="rounded-[var(--radius-card)] bg-surface-sunken p-4 text-sm text-text-muted">
              Elige una marca para ver qué prendas reciben más clics.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
