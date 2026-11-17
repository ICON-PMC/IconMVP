"use client";

import { useId, useState, useTransition } from "react";
import { FlagIcon } from "lucide-react";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { reportContent, type ReportReason, type ReportTarget } from "@/app/(app)/post/[id]/actions";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "not_fashion", label: "No es moda" },
  { id: "offensive", label: "Contenido ofensivo" },
  { id: "spam", label: "Spam o publicidad" },
  { id: "stolen_photo", label: "Usa fotos de otra persona" },
  { id: "other", label: "Otro" },
];

/** Reportar un look, perfil o prenda (spec 008, US5). */
export function ReportSheet({ targetType, targetId }: { targetType: ReportTarget; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "already">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const noteId = useId();

  function submit() {
    if (!reason) return setError("Elige un motivo.");
    setError(null);
    startTransition(async () => {
      const res = await reportContent({ targetType, targetId, reason, note });
      if (!res.ok) return void setError(res.error);
      setState(res.already ? "already" : "sent");
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <FlagIcon data-icon="inline-start" /> Reportar
      </Button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Reportar"
        description={state === "idle" ? targetType === "profile" ? "El equipo de Icon lo revisa. La persona no sabe quién reportó." : "El equipo de Icon lo revisa. Quien publicó no sabe quién reportó." : undefined}
        footer={
          state === "idle" ? (
            <Button size="lg" className="w-full" onClick={submit} loading={pending} disabled={pending}>
              Enviar reporte
            </Button>
          ) : (
            <Button size="lg" variant="secondary" className="w-full" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          )
        }
      >
        {state !== "idle" ? (
          <p role="status" className="py-6 text-center text-[15px] text-text">
            {state === "already" ? "Ya enviaste tu reporte. Gracias." : "Gracias. El equipo de Icon lo va a revisar."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-label text-text">Motivo</legend>
              {REASONS.map((r) => (
                <label
                  key={r.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-field)] border-[1.5px] px-3 text-[15px] text-text",
                    reason === r.id ? "border-text bg-surface-sunken" : "border-line",
                  )}
                >
                  <input type="radio" name="report-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="size-4 accent-current" />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={noteId} className="text-label text-text">
                Nota <span className="font-normal text-text-muted">(opcional)</span>
              </label>
              <Textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
              <span className="self-end text-[13px] text-text-muted tabular-nums">{note.length}/500</span>
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </ResponsiveSheet>
    </>
  );
}
