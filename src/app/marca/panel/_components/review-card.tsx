"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSignIcon, CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { R2Image } from "@/components/r2-image";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { AuthorChip } from "@/components/looks/author-chip";
import { ReportSheet } from "@/components/looks/report-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewItem } from "@/lib/claims";
import { reviewTag } from "../claims-actions";

const STATUS: Record<ReviewItem["status"], { label: string; variant: "verified" | "neutral" | "warning" }> = {
  pending: { label: "Por revisar", variant: "neutral" },
  accepted: { label: "Es nuestra", variant: "verified" },
  declined: { label: "No es nuestra", variant: "warning" },
};

/** Un look de usuario que etiqueta a la marca (spec 010, US1). */
export function ReviewCard({ item, brandName }: { item: ReviewItem; brandName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");

  function run(accept: boolean) {
    start(async () => {
      const r = await reviewTag(item.postId, accept, accept ? undefined : note);
      if (!r.ok) return void toast.error(r.error);
      toast.success(accept ? "Listo: el look muestra tus prendas como verificadas." : "Quitamos tu marca de este look.");
      setDeclining(false);
      router.refresh();
    });
  }

  const s = STATUS[item.status];
  return (
    <li className="flex gap-3 rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface-raised p-3">
      <Link href={`/post/${item.postId}`} target="_blank" className="h-36 w-28 shrink-0 overflow-hidden rounded-[var(--radius-field)] bg-surface-sunken">
        <R2Image image={item.image} alt="Look" sizes="112px" className="size-full object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {item.author ? <AuthorChip profile={item.author} size="sm" /> : <span className="text-sm text-text-muted">Usuario</span>}
          <Badge variant={s.variant}>{s.label}</Badge>
        </div>
        <ul className="flex flex-col gap-1.5" aria-label="Lo que etiqueta de tu marca">
          {item.garments.map((g) => (
            <li key={g.garmentId} className="flex items-center gap-2 text-sm text-text">
              <span className="size-8 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
                <R2Image image={g.image} alt="" sizes="32px" className="size-full object-cover" />
              </span>
              <span className="truncate">{g.title}</span>
            </li>
          ))}
          {item.mentioned && (
            <li className="flex items-center gap-2 text-sm text-text-muted">
              <AtSignIcon className="size-4" aria-hidden /> Menciona a {brandName}
            </li>
          )}
        </ul>
        {item.status === "declined" && item.note && <p className="text-[13px] text-text-muted">Tu nota: {item.note}</p>}
        <div className="mt-auto flex flex-wrap gap-2">
          {item.status !== "accepted" && item.status !== "declined" && (
            <>
              <Button size="sm" disabled={pending} onClick={() => run(true)}>
                <CheckIcon data-icon="inline-start" /> Sí, es nuestra
              </Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => setDeclining(true)}>
                <XIcon data-icon="inline-start" /> No es nuestra
              </Button>
            </>
          )}
          {item.status === "accepted" && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDeclining(true)}>
              No es nuestra
            </Button>
          )}
          <ReportSheet targetType="post" targetId={item.postId} />
        </div>
      </div>
      <ResponsiveSheet
        open={declining}
        onOpenChange={setDeclining}
        title="No es de tu marca"
        description="Quitamos tus prendas y la mención de este look. Quien lo publicó verá un aviso."
        footer={
          <Button variant="danger" className="w-full" loading={pending} onClick={() => run(false)}>
            Quitar mi marca del look
          </Button>
        }
      >
        <label htmlFor={`note-${item.postId}`} className="text-label text-text">
          Nota para quien lo publicó <span className="font-normal text-text-muted">(opcional)</span>
        </label>
        <Textarea
          id={`note-${item.postId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
          rows={3}
          className="mt-1.5"
          placeholder="Ej.: Esa chaqueta es de otra marca."
        />
      </ResponsiveSheet>
    </li>
  );
}
