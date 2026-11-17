import Link from "next/link";
import { Avatar } from "@/components/avatar";
import type { PublicProfile } from "@/lib/profiles";
import { cn } from "@/lib/utils";

/** Autor de un look de usuario (spec 008). Enlaza a su perfil cuando es público (spec 009, FR-007). */
export function AuthorChip({ profile, size = "md", className }: { profile: PublicProfile; size?: "sm" | "md"; className?: string }) {
  const body = (
    <>
      <Avatar image={profile.avatar} name={profile.displayName} seed={profile.id} size={size === "sm" ? 24 : 48} />
      <span className="min-w-0">
        <span className={cn("author-name block truncate font-semibold text-text", size === "sm" ? "text-[13px]" : "text-[15px]")}>
          {profile.displayName}
        </span>
        {size === "md" && <span className="block truncate text-[13px] text-text-muted">@{profile.handle}</span>}
      </span>
    </>
  );
  const box = cn("inline-flex min-w-0 items-center gap-2", className);
  return profile.isPublic ? (
    <Link href={`/u/${profile.handle}`} className={cn(box, "rounded-full hover:[&_.author-name]:underline")}>
      {body}
    </Link>
  ) : (
    <span className={box}>{body}</span>
  );
}
