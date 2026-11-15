"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** "Reintentar": marca pendientes las prendas sin huella al día y procesa una tanda (25). */
export function RetryVisualIndex() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/embeddings/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo procesar.");
      setMsg(`Procesadas ${body.processed}: ${body.ready} listas, ${body.failed} con error.`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo procesar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={run}>
        {busy ? "Procesando…" : "Reintentar / indexar pendientes"}
      </Button>
      {msg && <p className="text-xs text-ink/60">{msg}</p>}
    </div>
  );
}
