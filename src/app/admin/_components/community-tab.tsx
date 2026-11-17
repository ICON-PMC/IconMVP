"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CommunityData } from "@/lib/community-labels";
import { NativeSelect } from "@/components/native-select";
import {
  assignProposedBrand,
  claimBrandStub,
  mergeBrandStubs,
  mergeProposed,
  rejectProposedGarment,
  resolveProposedClaim,
  setBrandStubBlocked,
  setProfileHidden,
  setUserPostingBlock,
  unlinkProposed,
} from "../actions";

const dateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Elegir un destino de una lista y aplicar una acción (asignar, unificar). */
function PickAction({
  label,
  placeholder,
  options,
  disabled,
  onApply,
}: {
  label: string;
  placeholder: string;
  options: { id: string; name: string }[];
  disabled: boolean;
  onApply: (id: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex min-w-56 flex-1 items-center gap-2">
      <NativeSelect aria-label={placeholder} value={value} onChange={(e) => setValue(e.target.value)} className="h-10 text-sm">
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </NativeSelect>
      <Button size="sm" variant="secondary" disabled={disabled || !value} onClick={() => onApply(value)}>
        {label}
      </Button>
    </div>
  );
}

/** Marcas mencionadas, prendas propuestas, solicitudes, registro y cuentas bloqueadas (specs 008, 009 y 010). */
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
                {s.status === "open" && (
                  <>
                    <PickAction
                      label="Asignar"
                      placeholder="Asignar a marca…"
                      options={data.brands}
                      disabled={pending}
                      onApply={(id) => run(() => claimBrandStub(s.id, id), "Menciones asignadas a la marca.")}
                    />
                    <PickAction
                      label="Unificar"
                      placeholder="Unificar con…"
                      options={data.stubs.filter((x) => x.id !== s.id && x.status === "open")}
                      disabled={pending}
                      onApply={(id) => run(() => mergeBrandStubs(s.id, id), "Marcas unificadas.")}
                    />
                  </>
                )}
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
                <PickAction
                  label="Asignar"
                  placeholder="Asignar marca…"
                  options={data.brands}
                  disabled={pending}
                  onApply={(id) => run(() => assignProposedBrand(p.id, id), "Prenda asignada a la marca.")}
                />
                <PickAction
                  label="Unificar"
                  placeholder="Unificar con…"
                  options={data.proposed.filter((x) => x.id !== p.id).map((x) => ({ id: x.id, name: [x.name, x.brand].filter(Boolean).join(" · ") }))}
                  disabled={pending}
                  onApply={(id) => run(() => mergeProposed(p.id, id), "Prendas unificadas.")}
                />
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => rejectProposedGarment(p.id), "Prenda descartada; sus autores verán un aviso.")}>
                  Descartar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No hay prendas propuestas abiertas.</p>
        )}
      </section>

      <section aria-labelledby="c-requests" className="flex flex-col gap-3">
        <h2 id="c-requests" className="text-h3 text-text">
          Solicitudes de prendas sin marca
        </h2>
        {data.requests.length ? (
          <ul className="flex flex-col gap-2">
            {data.requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface-raised p-3">
                <p className="min-w-0 flex-1 text-sm text-text">
                  <strong className="font-semibold">{r.brand}</strong> dice que «{r.name}» es suya.
                </p>
                <Button size="sm" disabled={pending} onClick={() => run(() => resolveProposedClaim(r.id, true), "Solicitud aprobada.")}>
                  Aprobar
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resolveProposedClaim(r.id, false), "Solicitud rechazada.")}>
                  Rechazar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No hay solicitudes.</p>
        )}
      </section>

      <section aria-labelledby="c-links" className="flex flex-col gap-3">
        <div>
          <h2 id="c-links" className="text-h3 text-text">
            Prendas reclamadas (últimos 30 días)
          </h2>
          <p className="text-sm text-text-muted">Si una marca enlazó mal una prenda, deshazlo: los looks vuelven a mostrar la prenda propuesta.</p>
        </div>
        {data.recentLinks.length ? (
          <ul className="flex flex-col gap-2">
            {data.recentLinks.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface-raised p-3">
                <p className="min-w-0 flex-1 truncate text-sm text-text">
                  «{r.name}» {r.brand && <span className="text-text-muted">→ {r.brand}</span>}
                </p>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => unlinkProposed(r.id), "Enlace deshecho.")}>
                  Deshacer enlace
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Ninguna prenda reclamada en los últimos 30 días.</p>
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

      <section aria-labelledby="c-hidden-profiles" className="flex flex-col gap-3">
        <h2 id="c-hidden-profiles" className="text-h3 text-text">
          Perfiles ocultos
        </h2>
        {data.hiddenProfiles.length ? (
          <ul className="flex flex-col gap-2">
            {data.hiddenProfiles.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface-raised p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text">{u.label}</p>
                  {u.reason && <p className="text-[13px] text-text-muted">{u.reason}</p>}
                </div>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setProfileHidden(u.id, false), "Perfil restaurado.")}>
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Ningún perfil está oculto.</p>
        )}
      </section>
      <section aria-labelledby="c-events" className="flex flex-col gap-3">
        <h2 id="c-events" className="text-h3 text-text">
          Registro de acciones
        </h2>
        {data.events.length ? (
          <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface-raised px-3">
            {data.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <span className="text-text">{e.label}</span>
                <span className="text-[13px] text-text-muted">
                  {e.actor ?? "Sistema"} · {dateFmt.format(new Date(e.at))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Sin acciones todavía.</p>
        )}
      </section>
    </div>
  );
}
