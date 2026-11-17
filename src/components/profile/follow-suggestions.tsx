import { UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FollowList } from "@/components/profile/follow-list";
import type { FollowingRow } from "@/lib/profile";

/** Estado vacío de "Siguiendo" con marcas y personas para seguir (spec 009, FR-025). */
export function FollowSuggestions({ rows }: { rows: FollowingRow[] }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <EmptyState
        icon={UsersIcon}
        title="Aquí verás lo que publican las marcas y personas que sigues"
        description={rows.length ? "Empieza por alguna de estas:" : "Sigue marcas y personas desde su página."}
      />
      {rows.length > 0 && (
        <section className="surface px-5 md:px-6" aria-label="Sugerencias para seguir">
          <FollowList rows={rows} following={false} loginNext="/feed?ver=siguiendo" />
        </section>
      )}
    </div>
  );
}
