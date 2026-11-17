import { Avatar } from "@/components/avatar";
import type { PublicProfile } from "@/lib/profiles";
import { cn } from "@/lib/utils";

/** Autor de un look de usuario (spec 008). Sin enlace hasta que exista el perfil público (spec 009). */
export function AuthorChip({ profile, size = "md", className }: { profile: PublicProfile; size?: "sm" | "md"; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Avatar image={profile.avatar} name={profile.displayName} seed={profile.id} size={size === "sm" ? 24 : 48} />
      <span className="min-w-0">
        <span className={cn("block truncate font-semibold text-text", size === "sm" ? "text-[13px]" : "text-[15px]")}>
          {profile.displayName}
        </span>
        {size === "md" && <span className="block truncate text-[13px] text-text-muted">@{profile.handle}</span>}
      </span>
    </span>
  );
}
