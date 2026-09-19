import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/database.types";

type Props = { brand: Pick<Tables<"brands">, "status" | "rejection_note" | "submitted_at"> };

const box = "flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm";

// Estado de aprobación de la marca. Solo se renderiza para quien tiene una marca vinculada.
export function BrandStatusBanner({ brand }: Props) {
  if (brand.status === "active") {
    return (
      <div role="status" className={`${box} bg-leaf-soft text-forest-deep`}>
        <p className="font-medium">Tu marca está activa.</p>
      </div>
    );
  }

  if (brand.status === "rejected") {
    return (
      <div role="status" className={`${box} bg-coral/15 text-coral`}>
        <p>
          <span className="font-medium">Tu marca fue rechazada.</span>{" "}
          {brand.rejection_note}
        </p>
        <Button
          nativeButton={false}
          render={<Link href="/onboarding/marca?paso=1" />}
          className="h-9 rounded-full bg-coral px-4 text-white hover:bg-coral/90"
        >
          Editar y reenviar
        </Button>
      </div>
    );
  }

  // pending: aún sin enviar a revisión (onboarding incompleto) vs. ya enviada.
  if (!brand.submitted_at) {
    return (
      <div role="status" className={`${box} bg-honey-soft text-ink`}>
        <p className="font-medium">Falta enviar tu marca a revisión.</p>
        <Button
          nativeButton={false}
          render={<Link href="/onboarding/marca" />}
          className="h-9 rounded-full bg-forest px-4 text-white hover:bg-forest-deep"
        >
          Continuar registro
        </Button>
      </div>
    );
  }

  return (
    <div role="status" className={`${box} bg-honey-soft text-ink`}>
      <p className="font-medium">Tu marca está pendiente de aprobación.</p>
    </div>
  );
}
