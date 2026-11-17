import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { StarRating } from "@/components/star-rating";
import { ReportSheet } from "@/components/looks/report-sheet";
import type { RatingRow } from "@/lib/ratings";

const dateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });

/** Una reseña (spec 011, FR-007): autor (enlace si el perfil es público), estrellas, fecha y texto plano. */
export function RatingItemClient({ rating, canReport }: { rating: RatingRow; canReport: boolean }) {
  const a = rating.author;
  const who = (
    <>
      <Avatar image={a.avatar} name={a.name} seed={a.id} size={32} />
      <span className="truncate text-sm font-semibold text-text">{a.name}</span>
    </>
  );
  return (
    <li className="flex flex-col gap-2 border-b border-line py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        {a.isPublic ? (
          <Link href={`/u/${a.handle}`} className="flex min-w-0 items-center gap-2 hover:underline">
            {who}
          </Link>
        ) : (
          <span className="flex min-w-0 items-center gap-2">{who}</span>
        )}
        {canReport && <ReportSheet targetType="brand_review" targetId={rating.id} />}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
        <StarRating mode="display" value={rating.stars} />
        <span>{dateFmt.format(new Date(rating.createdAt))}</span>
        {rating.editedAt && <span>· Editada</span>}
      </div>
      <p className="text-[15px] leading-6 whitespace-pre-line text-text">{rating.body}</p>
    </li>
  );
}
