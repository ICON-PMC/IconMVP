import Link from "next/link";
import { BadgeCheckIcon, StarIcon } from "lucide-react";
import { formatRating } from "@/lib/rating-rules";
import { Avatar } from "@/components/avatar";

/**
 * Tarjeta de marca (spec 007, D4): fondo oscuro, logo, nombre, ciudad, hasta 3 estilos y número de
 * prendas. Se usa en la pestaña Marcas de la búsqueda.
 */
export function BrandCard({
  id,
  slug,
  name,
  bio,
  cityName,
  isVerified,
  isSustainable,
  garments,
  styles = [],
  logo = null,
  rating = null,
}: {
  id?: string;
  slug: string;
  name: string;
  bio: string | null;
  cityName: string | null;
  isVerified: boolean;
  isSustainable: boolean;
  garments: number;
  styles?: string[];
  logo?: string | null;
  /** Spec 011: solo con al menos 3 reseñas. */
  rating?: { avg: number; count: number } | null;
}) {
  return (
    <Link
      href={`/marca/${slug}`}
      className="surface-inverse flex flex-col gap-3 p-4 outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-3">
        <Avatar image={logo} name={name} seed={id ?? slug} size={48} className="bg-surface-raised" />
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-h3 text-text-inverse">
            <span className="truncate">{name}</span>
            {isVerified && <BadgeCheckIcon className="size-4 shrink-0 text-leaf" aria-label="verificada" />}
          </p>
          <p className="truncate text-[13px] text-text-inverse/80">
            {[cityName, isSustainable ? "Sostenible" : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {bio && <p className="line-clamp-2 text-sm text-text-inverse/85">{bio}</p>}
      {styles.length > 0 && (
        <ul aria-label="Estilos" className="flex flex-wrap gap-1.5">
          {styles.slice(0, 3).map((s) => (
            <li key={s} className="rounded-full border border-text-inverse/60 px-2.5 py-1 text-[11px] font-semibold">
              {s}
            </li>
          ))}
        </ul>
      )}
      {rating && (
        <p className="flex items-center gap-1 text-[13px] text-text-inverse">
          <StarIcon className="size-3.5 fill-honey text-honey" aria-hidden />
          <span className="font-semibold">{formatRating(rating.avg)}</span>
          <span className="text-text-inverse/80">({rating.count})</span>
          <span className="sr-only">reseñas</span>
        </p>
      )}
      <p className="mt-auto text-xs font-semibold text-leaf">
        {garments} {garments === 1 ? "prenda" : "prendas"}
      </p>
    </Link>
  );
}
