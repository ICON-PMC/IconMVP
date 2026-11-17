import Link from "next/link";
import { AtSignIcon, ShirtIcon, TagIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { getBrandPublishedGarments, getProposedInbox, getReviewInbox, type InboxCounts } from "@/lib/claims";
import { ReviewCard } from "./review-card";
import { ProposedCard } from "./proposed-card";

export type MentionsView = "looks" | "prendas" | "sin-marca";
export function parseMentionsView(v: string | undefined): MentionsView {
  return v === "prendas" || v === "sin-marca" ? v : "looks";
}

const base = "/marca/panel?tab=menciones";

/** Bandeja de menciones de la marca (spec 010): looks que la etiquetan, prendas propuestas y sin marca. */
export async function MentionsTab({
  brand,
  counts,
  view,
  estado,
  offset,
  categoryId,
  categories,
}: {
  brand: { id: string; name: string; status: string };
  counts: InboxCounts;
  view: MentionsView;
  estado: "pending" | "reviewed";
  offset: number;
  categoryId?: string;
  categories: { id: string; name: string }[];
}) {
  if (brand.status !== "active") {
    return <EmptyState icon={AtSignIcon} title="Disponible cuando aprobemos tu marca" description="Aquí verás los looks de la comunidad que etiquetan tu marca." />;
  }

  const tabs = (
    <LinkTabs
      label="Menciones"
      size="sm"
      active={view}
      className="mb-5"
      tabs={[
        { id: "looks", label: "Looks", href: base, badge: counts.reviewsPending || undefined },
        { id: "prendas", label: "Prendas", href: `${base}&ver=prendas`, badge: counts.proposedPending || undefined },
        { id: "sin-marca", label: "Sin marca", href: `${base}&ver=sin-marca`, badge: counts.unbrandedOpen || undefined },
      ]}
    />
  );
  const pager = (next: number | null, extra = "") => (
    <div className="mt-4 flex justify-between text-sm font-semibold">
      {offset > 0 ? <Link href={`${base}${extra}&desde=${Math.max(0, offset - 24)}`} className="text-action-text hover:underline">← Anteriores</Link> : <span />}
      {next != null && <Link href={`${base}${extra}&desde=${next}`} className="text-action-text hover:underline">Ver más →</Link>}
    </div>
  );

  if (view === "looks") {
    const { items, nextOffset } = await getReviewInbox(brand.id, estado, offset);
    const extra = estado === "reviewed" ? "&estado=revisadas" : "";
    return (
      <div>
        {tabs}
        <p className="mb-3 text-sm text-text-muted">
          Looks de la comunidad que etiquetan tus prendas o mencionan tu marca. Si confirmas, tus prendas aparecen verificadas.
        </p>
        <LinkTabs
          label="Estado"
          size="sm"
          variant="underline"
          active={estado}
          className="mb-4"
          tabs={[
            { id: "pending", label: "Pendientes", href: base },
            { id: "reviewed", label: "Revisadas", href: `${base}&estado=revisadas` },
          ]}
        />
        {items.length ? (
          <ul className="flex flex-col gap-3">
            {items.map((it) => (
              <ReviewCard key={it.postId} item={it} brandName={brand.name} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={AtSignIcon} title={estado === "pending" ? "Nada por revisar" : "Aún no revisas looks"} description="Cuando alguien etiquete tu marca en un look, aparecerá aquí." />
        )}
        {pager(nextOffset, extra)}
      </div>
    );
  }

  const scope = view === "prendas" ? "mine" : "unbranded";
  const [{ items, nextOffset }, catalog] = await Promise.all([
    getProposedInbox(brand.id, scope, offset, view === "sin-marca" ? categoryId : undefined),
    scope === "mine" ? getBrandPublishedGarments(brand.id) : Promise.resolve([]),
  ]);
  const extra = `&ver=${view}${categoryId && view === "sin-marca" ? `&cat=${categoryId}` : ""}`;
  return (
    <div>
      {tabs}
      <p className="mb-3 text-sm text-text-muted">
        {scope === "mine"
          ? "Prendas que la comunidad creó con el nombre de tu marca. Enlázalas con tu catálogo o agrégalas: los looks pasan a mostrar tu prenda con el botón a tu tienda."
          : "Prendas que la comunidad creó sin marca. Si una es tuya, pídela: el equipo de Icon lo revisa."}
      </p>
      {view === "sin-marca" && categories.length > 0 && (
        <LinkTabs
          label="Categoría"
          size="sm"
          active={categoryId ?? "todas"}
          className="mb-4"
          tabs={[{ id: "todas", label: "Todas", href: `${base}&ver=sin-marca` }, ...categories.map((c) => ({ id: c.id, label: c.name, href: `${base}&ver=sin-marca&cat=${c.id}` }))]}
        />
      )}
      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((it) => (
            <ProposedCard key={it.id} item={it} scope={scope} catalog={catalog} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={scope === "mine" ? ShirtIcon : TagIcon}
          title={scope === "mine" ? "No hay prendas por reclamar" : "No hay prendas sin marca"}
          description={scope === "mine" ? "Cuando alguien cree una prenda con el nombre de tu marca, aparecerá aquí." : "Vuelve más tarde."}
        />
      )}
      {pager(nextOffset, extra)}
    </div>
  );
}
