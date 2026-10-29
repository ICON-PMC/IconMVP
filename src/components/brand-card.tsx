import Link from "next/link";

export function BrandCard({
  slug,
  name,
  bio,
  cityName,
  isVerified,
  isSustainable,
  garments,
  styles = [],
}: {
  slug: string;
  name: string;
  bio: string | null;
  cityName: string | null;
  isVerified: boolean;
  isSustainable: boolean;
  garments: number;
  styles?: string[];
}) {
  return (
    <Link
      href={`/marca/${slug}`}
      className="block glass rounded-2xl p-4 transition hover:opacity-95"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-base font-medium text-forest">{name}</span>
        {isVerified && (
          <span title="Verificada por el equipo" aria-label="verificada" className="text-forest">
            ✓
          </span>
        )}
        {isSustainable && (
          <span title="Sostenible" aria-label="sostenible">
            🌱
          </span>
        )}
      </div>
      {cityName && <p className="mt-0.5 text-xs text-ink/50">{cityName}</p>}
      {bio && <p className="mt-2 line-clamp-2 text-sm text-ink/70">{bio}</p>}
      {styles.length > 0 && (
        <ul aria-label="Estilos" className="mt-2 flex flex-wrap gap-1">
          {styles.map((s) => (
            <li key={s} className="rounded-full bg-white/50 px-2 py-0.5 text-xs text-forest-deep">
              {s}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs font-medium text-ink/50">
        {garments} {garments === 1 ? "prenda" : "prendas"}
      </p>
    </Link>
  );
}
