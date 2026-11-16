"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setUserPostingBlock, setUserRole } from "../actions";

export type AdminUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "user" | "brand" | "curator" | "admin";
  brand_name: string | null;
  created_at: string;
};

const ROLE_LABEL: Record<AdminUser["role"], string> = {
  user: "Usuario",
  brand: "Marca",
  curator: "Curador",
  admin: "Admin",
};

const dateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });

/**
 * Lista de usuarios. Solo un admin ve el selector de rol (la base vuelve a validarlo con
 * `set_user_role`); el curator la ve como texto. Nadie cambia su propio rol.
 */
export function UsersTab({
  users,
  q,
  canEdit,
  myId,
  blockedIds = [],
}: {
  users: AdminUser[];
  q: string;
  canEdit: boolean;
  myId: string;
  /** Cuentas que no pueden publicar looks (spec 008). */
  blockedIds?: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function change(u: AdminUser, role: string) {
    start(async () => {
      const r = await setUserRole(u.id, role);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${u.email ?? "Usuario"} ahora es ${ROLE_LABEL[role as AdminUser["role"]]}.`);
      router.refresh();
    });
  }

  function toggleBlock(u: AdminUser, blocked: boolean) {
    const reason = blocked ? window.prompt(`Motivo para bloquear a ${u.email ?? "esta cuenta"} (lo ve el equipo):`) : null;
    if (blocked && reason === null) return;
    start(async () => {
      const r = await setUserPostingBlock(u.id, blocked, reason ?? undefined);
      if (!r.ok) return void toast.error(r.error);
      toast.success(blocked ? "La cuenta ya no puede publicar." : "La cuenta puede publicar de nuevo.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form className="flex gap-2" action="/admin">
        <input type="hidden" name="tab" value="usuarios" />
        <Input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Buscar usuario"
          placeholder="Buscar por correo o nombre"
        />
      </form>
      {!canEdit && (
        <p className="text-xs text-ink/60">Solo un admin puede cambiar roles.</p>
      )}
      {users.length ? (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id} className="bg-surface-raised border-[1.5px] border-line text-text focus:border-line-strong focus:outline-none flex flex-wrap items-center gap-3 rounded-2xl p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{u.email ?? "(sin correo)"}</p>
                <p className="truncate text-xs text-ink/50">
                  {[u.display_name, u.brand_name && `Marca: ${u.brand_name}`, dateFmt.format(new Date(u.created_at))]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {u.role === "user" && (
                <Button
                  size="sm"
                  variant={blockedIds.includes(u.id) ? "secondary" : "ghost"}
                  disabled={pending}
                  onClick={() => toggleBlock(u, !blockedIds.includes(u.id))}
                >
                  {blockedIds.includes(u.id) ? "Desbloquear publicación" : "Bloquear publicación"}
                </Button>
              )}
              {canEdit && u.id !== myId ? (
                <NativeSelect
                  aria-label={`Rol de ${u.email ?? "usuario"}`}
                  value={u.role}
                  disabled={pending}
                  onChange={(e) => change(u, e.target.value)}
                  className="w-36"
                >
                  {Object.entries(ROLE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <span className="rounded-full bg-surface-sunken px-3 py-1 text-xs text-ink/70">
                  {ROLE_LABEL[u.role]}
                  {u.id === myId && " (tú)"}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={q ? `Nadie coincide con «${q}»` : "Aún no hay usuarios"} />
      )}
    </div>
  );
}
