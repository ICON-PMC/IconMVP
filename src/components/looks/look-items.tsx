"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowUpRightIcon, BadgeCheckIcon, CircleHelpIcon, StoreIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { R2Image } from "@/components/r2-image";
import { SaveButton } from "@/components/save-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCop } from "@/lib/taxonomy";
import type { LookGarment, LookMention, LookProposed } from "@/lib/look-rules";
import { removeMention, removeProposedGarment, untagGarment } from "@/app/(app)/crear/actions";

/**
 * Lo etiquetado en un look (spec 008, contracts §7). `edit`: con botón para quitar. `view` (ficha):
 * prendas de catálogo con "Ir a la tienda" (clic atribuido al look), prendas propuestas "Sin
 * verificar" y marcas mencionadas (de Icon → su página; las que no están → invitación a registrarse).
 */
export function LookItems({
  postId,
  garments,
  proposed,
  mentions,
  mode,
  savedGarmentIds = [],
  path,
}: {
  postId: string;
  garments: LookGarment[];
  proposed: LookProposed[];
  mentions: LookMention[];
  mode: "edit" | "view";
  /** Ficha: prendas ya guardadas por quien mira y ruta a revalidar. */
  savedGarmentIds?: string[];
  path?: string;
}) {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "No pudimos quitarlo.");
    });

  const removeBtn = (label: string, onClick: () => void) =>
    mode === "edit" ? (
      <Button size="icon-sm" variant="ghost" aria-label={`Quitar ${label}`} disabled={pending} onClick={onClick}>
        <XIcon />
      </Button>
    ) : null;

  if (!garments.length && !proposed.length && !mentions.length) return null;

  return (
    <ul className="flex flex-col gap-2">
      {garments.map((g) => (
        <li key={g.itemId} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface-raised p-2 ring-1 ring-line">
          <Link href={`/prenda/${g.garmentId}`} className="size-16 shrink-0 overflow-hidden rounded-[var(--radius-field)] bg-surface-sunken">
            <R2Image image={g.image} alt="" sizes="64px" className="size-full object-cover" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/prenda/${g.garmentId}`} className="block truncate text-sm font-semibold text-text hover:underline">
              {g.title}
            </Link>
            <p className="truncate text-[13px] text-text-muted">
              {g.brandName}
              {g.priceCop != null && ` · ${formatCop(g.priceCop)}`}
            </p>
            {(g.color || g.size) && (
              <p className="truncate text-xs text-text-muted">{[g.color, g.size ? `Talla ${g.size}` : null].filter(Boolean).join(" · ")}</p>
            )}
            {!g.available && <p className="text-[13px] font-medium text-danger">Ya no está publicada</p>}
            {mode === "view" && g.verified && (
              <Badge variant="verified" className="mt-1">
                <BadgeCheckIcon data-icon="inline-start" /> Confirmada por la marca
              </Badge>
            )}
          </div>
          {mode === "view" && g.available ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {path && <SaveButton kind="garment" id={g.garmentId} sourcePostId={postId} saved={savedGarmentIds.includes(g.garmentId)} path={path} compact />}
              <Button
              size="sm"
              render={<a href={`/out/${g.garmentId}?post=${postId}&source=post`} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
                Tienda <ArrowUpRightIcon data-icon="inline-end" />
              </Button>
            </div>
          ) : (
            removeBtn(g.title, () => run(() => untagGarment(postId, g.itemId)))
          )}
        </li>
      ))}

      {proposed.map((p) => (
        <li key={p.itemId} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface-raised p-3 ring-1 ring-line">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-text-muted">
            <CircleHelpIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">{p.name}</p>
            <p className="truncate text-[13px] text-text-muted">
              {[p.categoryName, p.colors.join(", "), p.brandLabel].filter(Boolean).join(" · ")}
            </p>
            <Badge variant="warning" className="mt-1">
              Sin verificar
            </Badge>
          </div>
          {removeBtn(p.name, () => run(() => removeProposedGarment(postId, p.itemId)))}
        </li>
      ))}

      {mentions.map((m) => (
        <li key={m.id} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface-raised p-3 ring-1 ring-line">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-text-muted">
            <StoreIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            {m.kind === "brand" && m.slug ? (
              <Link href={`/marca/${m.slug}`} className="block truncate text-sm font-semibold text-text hover:underline">
                {m.name}
              </Link>
            ) : (
              <p className="truncate text-sm font-semibold text-text">{m.name}</p>
            )}
            {m.blocked ? (
              <p className="text-[13px] font-medium text-danger">Esta marca no hace parte de Icon</p>
            ) : m.kind === "stub" ? (
              <p className="text-[13px] text-text-muted">
                Aún no está en Icon
                {mode === "view" && (
                  <>
                    {" · "}
                    <Link href={`/signup?marca=${m.targetId}`} className="font-medium text-action-text hover:underline">
                      ¿Es tu marca? Regístrala
                    </Link>
                  </>
                )}
              </p>
            ) : (
              <p className="text-[13px] text-text-muted">Marca mencionada</p>
            )}
          </div>
          {removeBtn(m.name, () => run(() => removeMention(postId, m.id)))}
        </li>
      ))}
    </ul>
  );
}
