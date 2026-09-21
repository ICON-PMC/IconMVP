import Link from "next/link";
import { GlassCard } from "@/components/glass-card";
import { SectionHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { disconnectInstagram } from "../actions";

type Connection = {
  username: string | null;
  account_type: string | null;
  connected_at: string;
} | null;

export function OverviewTab({
  counts,
  connection,
}: {
  counts: { garments: number; looks: number; drafts: number };
  connection: Connection;
}) {
  const tiles = [
    { label: "Prendas", value: counts.garments, href: "/marca/panel?tab=catalogo" },
    { label: "Looks", value: counts.looks, href: "/marca/panel?tab=looks" },
    { label: "Borradores", value: counts.drafts, href: "/marca/panel?tab=looks" },
  ];

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className="glass block rounded-2xl px-3 py-4 text-center transition-colors hover:bg-white/40"
            >
              <span className="block text-2xl font-medium text-forest">{t.value}</span>
              <span className="block text-[11px] uppercase tracking-wide text-ink/60">
                {t.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <GlassCard className="p-5">
        <SectionHeader title="Instagram" />
        {connection ? (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-ink">
              Conectado como <span className="font-medium">@{connection.username}</span>
              <span className="block text-xs text-ink/60">
                {connection.account_type} · desde{" "}
                {new Date(connection.connected_at).toLocaleDateString("es-CO")}
              </span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                nativeButton={false}
                render={<Link href="/marca/panel/import" />}
                className="rounded-full sm:px-5"
              >
                Importar fotos
              </Button>
              <form action={disconnectInstagram}>
                <Button variant="ghost" type="submit" className="w-full rounded-full sm:w-auto">
                  Desconectar
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-ink/70">
              Conecta tu cuenta profesional para traer tus fotos como borradores de looks.
            </p>
            <Button
              nativeButton={false}
              render={<a href="/api/instagram/authorize" />}
              className="w-full rounded-full sm:w-auto sm:px-5"
            >
              Conectar con Instagram
            </Button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
