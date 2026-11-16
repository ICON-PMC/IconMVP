import { createClient } from "@/lib/supabase/server";
import { SectionHeader } from "@/components/page-shell";
import { RetryVisualIndex } from "./retry-visual-index";

/**
 * Búsqueda por foto en /admin (spec 005, FR-018 y FR-020): cuántas prendas publicadas son
 * buscables, las que fallaron, y uso de los últimos 7 días.
 */
async function loadVisualStats() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  return Promise.all([
    supabase.rpc("visual_index_status"),
    supabase.from("garment_embeddings").select("garment_id, error").eq("status", "failed").limit(20),
    supabase.from("photo_searches").select("kind, below_threshold").gte("created_at", since),
    supabase.from("outbound_clicks").select("source").in("source", ["photo_search", "similar"]).gte("created_at", since),
  ]);
}

export async function VisualIndexCard() {
  const [{ data: status }, { data: failed }, { data: searches }, { data: clicks }] = await loadVisualStats();

  const count = (s: string) => status?.find((r) => r.status === s)?.n ?? 0;
  const total = (status ?? []).reduce((n, r) => n + r.n, 0);
  const ready = count("ready");
  const photo = (searches ?? []).filter((s) => s.kind === "photo");
  const good = photo.filter((s) => !s.below_threshold).length;
  const clicksPhoto = (clicks ?? []).filter((c) => c.source === "photo_search").length;
  const clicksSimilar = (clicks ?? []).filter((c) => c.source === "similar").length;

  const stat = (label: string, value: string, hint?: string) => (
    <div className="bg-surface-raised border-[1.5px] border-line text-text focus:border-line-strong focus:outline-none rounded-xl p-3">
      <p className="text-xs text-ink/55">{label}</p>
      <p className="text-xl font-medium text-forest">{value}</p>
      {hint && <p className="text-xs text-ink/45">{hint}</p>}
    </div>
  );

  return (
    <section className="mt-8">
      <SectionHeader title="Búsqueda por foto" />
      <div className="surface mt-3 space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat("Prendas buscables", total ? `${Math.round((100 * ready) / total)} %` : "—", `${ready} de ${total}`)}
          {stat("Pendientes / con error", `${count("pending")} / ${count("failed")}`, count("sin_foto") ? `${count("sin_foto")} sin foto` : undefined)}
          {stat("Búsquedas (7 días)", String(photo.length), photo.length ? `${Math.round((100 * good) / photo.length)} % muy parecidas` : undefined)}
          {stat("Clics a tienda (7 días)", String(clicksPhoto + clicksSimilar), `${clicksPhoto} por foto · ${clicksSimilar} "más como esta"`)}
        </div>
        {(failed?.length ?? 0) > 0 && (
          <ul className="space-y-1 text-xs text-ink/60">
            {failed!.map((f) => (
              <li key={f.garment_id}>
                <a href={`/prenda/${f.garment_id}`} className="font-mono text-coral hover:underline">
                  {f.garment_id.slice(0, 8)}
                </a>{" "}
                — {f.error}
              </li>
            ))}
          </ul>
        )}
        <RetryVisualIndex />
      </div>
    </section>
  );
}
