import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { UserFollowButton } from "@/components/profile/user-follow-button";
import type { FollowingRow } from "@/lib/profile";

/**
 * Lista de marcas y personas con su botón de seguir. La usan "Personas y marcas que sigues" y las
 * sugerencias del estado vacío de "Siguiendo" (spec 009).
 */
export function FollowList({ rows, following, loginNext }: { rows: FollowingRow[]; following: boolean; loginNext: string }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((r) => {
        const href = r.kind === "brand" ? `/marca/${r.slugOrHandle}` : `/u/${r.slugOrHandle}`;
        return (
          <li key={`${r.kind}-${r.id}`} className="flex items-center gap-3 py-3">
            <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-full hover:[&_.row-name]:underline">
              <Avatar image={r.image} name={r.name} seed={r.id} size={48} />
              <span className="min-w-0">
                <span className="row-name block truncate text-[15px] font-semibold text-text">{r.name}</span>
                <span className="block truncate text-[13px] text-text-muted">{r.kind === "brand" ? "Marca" : `@${r.slugOrHandle}`}</span>
              </span>
            </Link>
            {r.kind === "brand" ? (
              <FollowButton brandId={r.id} slug={r.slugOrHandle} initialFollowing={following} isLoggedIn />
            ) : (
              <UserFollowButton userId={r.id} initialFollowing={following} isLoggedIn loginNext={loginNext} size="sm" />
            )}
          </li>
        );
      })}
    </ul>
  );
}
