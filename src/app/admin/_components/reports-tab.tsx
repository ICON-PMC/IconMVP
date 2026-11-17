"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlagIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { R2Image } from "@/components/r2-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { REASON_LABEL, type ReportGroup } from "@/lib/community-labels";
import { dismissReports, moderateBrandRating, moderatePost, setProfileHidden, setUserPostingBlock } from "../actions";

const dateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });

/** Cola de reportes abiertos, agrupados por objetivo (spec 008, US5). */
export function ReportsTab({ groups }: { groups: ReportGroup[] }) {
  if (!groups.length)
    return <EmptyState icon={FlagIcon} title="No hay reportes abiertos" description="Cuando alguien reporte un look, un perfil o una reseña, aparecerá aquí." />;
  return (
    <ul className="flex flex-col gap-3">
      {groups.map((g) => (
        <ReportRow key={`${g.targetType}:${g.targetId}`} group={g} />
      ))}
    </ul>
  );
}

function ReportRow({ group: g }: { group: ReportGroup }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "No se pudo.");
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface-raised p-3 sm:flex-row">
      {g.post && (
        <Link href={`/post/${g.post.id}`} target="_blank" className="h-36 w-28 shrink-0 overflow-hidden rounded-[var(--radius-field)] bg-surface-sunken">
          <R2Image image={g.post.image} alt="" sizes="112px" className="size-full object-cover" />
        </Link>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-text">{g.label}</p>
          <Badge variant="warning">
            {g.count} {g.count === 1 ? "reporte" : "reportes"}
          </Badge>
          {g.post?.hiddenReason === "auto" && <Badge variant="neutral">Oculto automáticamente</Badge>}
          <span className="text-[13px] text-text-muted">desde {dateFmt.format(new Date(g.firstAt))}</span>
        </div>
        {g.post && <p className="text-sm text-text-muted">{g.post.author}</p>}
        {g.rating && (
          <div className="flex flex-col gap-1 rounded-[var(--radius-field)] bg-surface-sunken p-3 text-sm text-text">
            <p className="text-[13px] text-text-muted">
              {"★".repeat(g.rating.stars)}
              {"☆".repeat(5 - g.rating.stars)} · {g.rating.author}
              {g.rating.status === "auto_hidden" && " · Oculta automáticamente"}
              {g.rating.status === "removed" && " · Retirada"}
            </p>
            <p className="line-clamp-4 whitespace-pre-line">{g.rating.body}</p>
            {g.rating.brandSlug && (
              <Link href={`/marca/${g.rating.brandSlug}?tab=resenas`} target="_blank" className="w-fit text-[13px] font-semibold text-action-text hover:underline">
                Ver en la página de {g.rating.brandName}
              </Link>
            )}
          </div>
        )}
        {g.targetType === "profile" && g.profileHandle && (
          <Link href={`/u/${g.profileHandle}`} target="_blank" className="w-fit text-sm font-semibold text-action-text hover:underline">
            Ver perfil
          </Link>
        )}
        {g.post?.caption && <p className="line-clamp-2 text-sm text-text">{g.post.caption}</p>}
        <p className="text-sm text-text">{g.reasons.map((r) => `${REASON_LABEL[r.reason] ?? r.reason} (${r.n})`).join(" · ")}</p>
        {g.notes.length > 0 && (
          <ul className="flex flex-col gap-1 text-[13px] text-text-muted">
            {g.notes.slice(0, 5).map((n, i) => (
              <li key={i}>“{n}”</li>
            ))}
          </ul>
        )}
        {hiding ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (lo ve quien publicó)" className="min-w-48 flex-1" maxLength={200} />
            <Button
              variant="danger"
              size="sm"
              disabled={pending || !reason.trim()}
              onClick={() =>
                g.targetType === "profile"
                  ? run(() => setProfileHidden(g.targetId, true, reason), "Perfil ocultado.")
                  : run(() => moderatePost(g.targetId, "hide", reason), "Look ocultado.")
              }
            >
              {g.targetType === "profile" ? "Ocultar perfil" : "Ocultar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setHiding(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {g.targetType === "post" && g.post && (
              <>
                <Button variant="danger" size="sm" disabled={pending} onClick={() => setHiding(true)}>
                  Ocultar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => moderatePost(g.targetId, g.post?.hiddenReason === "auto" ? "restore" : "dismiss"),
                      g.post?.hiddenReason === "auto" ? "Look restaurado." : "Reportes descartados.",
                    )
                  }
                >
                  {g.post.hiddenReason === "auto" ? "Restaurar" : "Descartar"}
                </Button>
                {g.post.authorUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => setUserPostingBlock(g.post!.authorUserId!, true, "Reportes"), "Cuenta bloqueada para publicar.")}
                  >
                    Bloquear publicación
                  </Button>
                )}
              </>
            )}
            {g.rating && (
          <div className="flex flex-col gap-1 rounded-[var(--radius-field)] bg-surface-sunken p-3 text-sm text-text">
            <p className="text-[13px] text-text-muted">
              {"★".repeat(g.rating.stars)}
              {"☆".repeat(5 - g.rating.stars)} · {g.rating.author}
              {g.rating.status === "auto_hidden" && " · Oculta automáticamente"}
              {g.rating.status === "removed" && " · Retirada"}
            </p>
            <p className="line-clamp-4 whitespace-pre-line">{g.rating.body}</p>
            {g.rating.brandSlug && (
              <Link href={`/marca/${g.rating.brandSlug}?tab=resenas`} target="_blank" className="w-fit text-[13px] font-semibold text-action-text hover:underline">
                Ver en la página de {g.rating.brandName}
              </Link>
            )}
          </div>
        )}
        {g.targetType === "profile" && g.profileHandle && (
              <Button variant="danger" size="sm" disabled={pending} onClick={() => setHiding(true)}>
                Ocultar perfil
              </Button>
            )}
            {g.targetType === "brand_review" && g.rating && (
              <>
                <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => moderateBrandRating(g.targetId, "remove"), "Reseña retirada.")}>
                  Retirar
                </Button>
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => moderateBrandRating(g.targetId, "restore"), "Reseña restaurada.")}>
                  Restaurar
                </Button>
              </>
            )}
            {g.targetType !== "post" && g.targetType !== "brand_review" && (
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => dismissReports(g.targetType as "profile", g.targetId), "Reportes descartados.")}>
                Descartar
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
