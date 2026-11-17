"use client";

import { Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Compartir: menú del sistema en celular; copiar enlace en escritorio (spec 009, FR-026). */
export function ShareButton({ url, title }: { url: string; title: string }) {
  async function share() {
    const full = new URL(url, window.location.origin).toString();
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ url: full, title });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(full);
      toast.success("Enlace copiado.");
    } catch {
      toast.error("No pudimos copiar el enlace.");
    }
  }
  return (
    <Button variant="secondary" onClick={share} aria-label="Compartir perfil">
      <Share2Icon data-icon="inline-start" /> Compartir
    </Button>
  );
}
