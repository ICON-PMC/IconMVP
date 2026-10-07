import Link from "next/link";
import { GlassCard } from "@/components/glass-card";
import { SectionHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { disconnectInstagram } from "../actions";

type Connection = {
  username: string | null;
  account_type: string | null;
  connected_at: string;
  token_expires_at: string;
} | null;

type Storage = { used_bytes: number; limit_bytes: number } | null;

const mb = (b: number) => (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0);

export function OverviewTab({
  counts,
  instagramEnabled,
  connection,
  storage,
}: {
  counts: { garments: number; looks: number; drafts: number };
  instagramEnabled: boolean;
  connection: Connection;
  storage: Storage;
}) {
  const tiles = [
    { label: "Prendas", value: counts.garments, href: "/marca/panel?tab=catalogo" },
    { label: "Looks", value: counts.looks, href: "/marca/panel?tab=looks" },
    { label: "Borradores", value: counts.drafts, href: "/marca/panel?tab=looks" },
  ];

  // Comparación contra "ahora" en el render del servidor: es un server component.
  // eslint-disable-next-line react-hooks/purity
  const expired = connection ? new Date(connection.token_expires_at).getTime() <= Date.now() : false;

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

      {storage && <StorageMeter storage={storage} />}

      {instagramEnabled && (
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
              {expired && (
                <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
                  La conexión con Instagram venció. Reconéctala para seguir importando fotos.
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                {expired ? (
                  <Button
                    nativeButton={false}
                    render={<a href="/api/instagram/authorize" />}
                    className="rounded-full sm:px-5"
                  >
                    Reconectar Instagram
                  </Button>
                ) : (
                  <Button
                    nativeButton={false}
                    render={<Link href="/marca/panel/import" />}
                    className="rounded-full sm:px-5"
                  >
                    Importar fotos
                  </Button>
                )}
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
      )}
    </div>
  );
}

// Uso de la cuota de R2 (300 MB por marca). Amarillo desde el 80 %, coral al llegar al límite.
function StorageMeter({ storage }: { storage: NonNullable<Storage> }) {
  const pct = Math.min(100, Math.round((storage.used_bytes / storage.limit_bytes) * 100));
  const full = storage.used_bytes >= storage.limit_bytes;
  const warn = !full && pct >= 80;
  return (
    <GlassCard className="p-5">
      <SectionHeader title="Almacenamiento" />
      <div
        role="meter"
        aria-label="Almacenamiento usado"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className={`h-full rounded-full ${full ? "bg-coral" : warn ? "bg-honey" : "bg-forest"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-ink/70">
        {mb(storage.used_bytes)} MB de {mb(storage.limit_bytes)} MB
        {full
          ? " · Llegaste al límite: borra fotos o prendas que ya no uses para subir nuevas."
          : warn
            ? " · Te queda poco espacio."
            : ""}
      </p>
    </GlassCard>
  );
}
