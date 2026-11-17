import { StarIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { RatingSummary } from "@/components/ratings/rating-summary";
import { RatingList } from "@/components/ratings/rating-list";
import { getRatings, getRatingSummary } from "@/lib/ratings";

/** Reseñas de la marca en su panel (spec 011, US4): solo lectura, con "Reportar". */
export async function RatingsTab({ brandId, myId }: { brandId: string; myId: string }) {
  const [summary, page] = await Promise.all([getRatingSummary(brandId), getRatings(brandId, { sort: "recent", offset: 0 })]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <RatingSummary summary={summary} />
      <p className="text-sm text-text-muted">
        Las reseñas las escribe la comunidad. No puedes editarlas ni borrarlas; si una incumple las normas, repórtala y el
        equipo de Icon la revisa.
      </p>
      {page.items.length ? (
        <RatingList brandId={brandId} sort="recent" stars={null} initial={page.items} initialNext={page.nextOffset} myId={myId} isLoggedIn />
      ) : (
        <EmptyState icon={StarIcon} title="Aún no tienes reseñas" description="Cuando alguien reseñe tu marca, aparecerá aquí." />
      )}
    </div>
  );
}
