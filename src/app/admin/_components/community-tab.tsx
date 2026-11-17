"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CommunityData } from "@/lib/community-labels";
import { rejectProposedGarment, setBrandStubBlocked, setUserPostingBlock } from "../actions";

/** Marcas mencionadas, prendas propuestas y cuentas bloqueadas (spec 008, US5). */
export function CommunityTab({ data }: { data: CommunityData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "No se pudo.");
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="c-stubs" className="flex flex-col gap-3">
        <div>
          <h2 id="c-stubs" className="text-h3 text-text">
            Marcas mencionadas
          </h2>
          <p className="text-sm text-text-muted">Marcas que los usuarios etiquetan y aún no están en Icon. Las más mencionadas, primero.</p>
        </div>
        {data.stubs.length ? (
          <ul className="flex flex-col gap-2">
            {data.stubs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface-raised p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text">{s.name}</p>
                  <p className="text-[13px] text-text-muted">
                    {s.mentions} {s.mentions === 1 ? "mención" : "menciones"}
                  </p>
                </div>
                {s.status === "blocked" && <Badge variant="warning">Bloqueada</Badge>}
                <Button
                  size="sm"
                  variant={s.status === "blocked" ? "secondary" : "ghost"}
                  disabled={pending}
                  onClick={() =>
                    run(() => setBrandStubBlocked(s.id, s.status !== "blocked"), s.status === "blocked" ? "Marca desbloqueada." : "Marca bloqueada.")
                  }
                >
                  {s.status === "blocked" ? "Desbloquear" : "Bloquear"}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Nadie ha mencionado marcas nuevas todavía.</p>
        )}
      </section>

      <section aria-labelledby="c-proposed" className="flex flex-col gap-3">
        <div>
          <h2 id="c-proposed" className="text-h3 text-text">
            Prendas propuestas
          </h2>
          <p className="text-sm text-text-muted">Prendas que los usuarios crearon porque no estaban en el catálogo.</p>
        </div>
        {data.proposed.length ? (
          <ul className="flex flex-col gap-2">
            {data.proposed.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface-raised p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text">{p.name}</p>
                  <p className="truncate text-[13px] text-text-muted">{[p.category, p.brand].filter(Boolean).join(" · ")}</p>
                </div>
                {p.postId && (
                  <Button size="sm" variant="ghost" render={<Link href={`/post/${p.postId}`} target="_blank" />} nativeButton={false}>
                    Ver look
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => rejectProposedGarment(p.id), "Prenda descartada.")}>
                  Descartar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No hay prendas propuestas abiertas.</p>
        )}
      </section>

      <section aria-labelledby="c-blocked" className="flex flex-col gap-3">
        <h2 id="c-blocked" className="text-h3 text-text">
          Cuentas que no pueden publicar
        </h2>
        {data.blocked.length ? (
          <ul className="flex flex-col gap-2">
            {data.blocked.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface-raised p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text">{u.label}</p>
                  {u.reason && <p className="text-[13px] text-text-muted">{u.reason}</p>}
                </div>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setUserPostingBlock(u.id, false), "Cuenta desbloqueada.")}>
                  Desbloquear
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Ninguna cuenta está bloqueada.</p>
        )}
      </section>
    </div>
  );
}
