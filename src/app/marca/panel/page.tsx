import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBrandOwner } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { SiteHeader } from "@/components/site-header";
import { BrandStatusBanner } from "@/components/brand-status-banner";
import { imageUrl } from "@/lib/images";
import { formatCop } from "@/lib/taxonomy";
import { updateBrandProfile, createBrandGarment, disconnectInstagram } from "./actions";

const input =
  "glass-input w-full rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink/40";
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-ink/50";
const submit =
  "rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-forest-deep";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

export default async function BrandPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { brand } = await requireBrandOwner();
  const { ok, error } = await searchParams;

  if (!brand) {
    return (
      <>
        <Aurora />
        <div className="mx-auto w-full max-w-lg px-4 py-6">
          <SiteHeader />
          <GlassCard className="mt-10 p-8 text-center">
            <h1 className="text-2xl font-medium tracking-tight text-forest">
              Conecta tu marca
            </h1>
            <p className="mt-2 text-sm text-ink/60">
              Inicia sesión con tu cuenta de Instagram profesional (Business o Creator)
              para traer tus fotos a Icon.
            </p>
            {error && (
              <p className="mt-4 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
                {error}
              </p>
            )}
            <a
              href="/api/instagram/authorize"
              className="mt-6 inline-block rounded-full bg-forest px-6 py-2.5 text-sm font-medium text-white hover:bg-forest-deep"
            >
              Conectar con Instagram
            </a>
          </GlassCard>
        </div>
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: connection }, { data: garments }, { data: posts }] = await Promise.all([
    supabase
      .from("brand_instagram_connections")
      .select("username, account_type, connected_at, token_expires_at")
      .eq("brand_id", brand.id)
      .maybeSingle(),
    supabase
      .from("garments")
      .select("id, title, price_cop, status")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("posts")
      .select("id, caption, status, published_at, created_at")
      .eq("author_brand_id", brand.id)
      .order("created_at", { ascending: false }),
  ]);

  const [{ data: categories }, { data: sizes }] = await Promise.all([
    supabase.from("tags").select("id, name").eq("type", "category").order("name"),
    supabase.from("sizes").select("id, label").order("sort_order"),
  ]);

  const gIds = (garments ?? []).map((g) => g.id);
  const gImages = gIds.length
    ? ((
        await supabase
          .from("garment_images")
          .select("garment_id, cf_image_id")
          .in("garment_id", gIds)
          .eq("position", 0)
      ).data ?? [])
    : [];
  const gImageMap = new Map(gImages.map((i) => [i.garment_id, i.cf_image_id]));

  const pIds = (posts ?? []).map((p) => p.id);
  const [pImagesRes, pItemsRes] = pIds.length
    ? await Promise.all([
        supabase
          .from("post_images")
          .select("post_id, cf_image_id")
          .in("post_id", pIds)
          .eq("position", 0),
        supabase.from("post_items").select("post_id").in("post_id", pIds),
      ])
    : [{ data: [] }, { data: [] }];
  const pImageMap = new Map((pImagesRes.data ?? []).map((i) => [i.post_id, i.cf_image_id]));
  const itemCounts = new Map<string, number>();
  for (const it of pItemsRes.data ?? []) {
    itemCounts.set(it.post_id, (itemCounts.get(it.post_id) ?? 0) + 1);
  }

  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <SiteHeader />

        <div className="mt-8 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-medium tracking-tight text-forest">Mi marca</h1>
        </div>

        <div className="mt-4">
          <BrandStatusBanner brand={brand} />
        </div>

        {ok && (
          <p className="mt-4 rounded-xl bg-leaf-soft px-3 py-2 text-sm text-forest-deep">
            ✓ Listo.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">{error}</p>
        )}

        {/* Conexión de Instagram */}
        <GlassCard className="mt-6 p-6">
          <h2 className="mb-3 text-lg font-medium text-forest">Instagram</h2>
          {connection ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink">
                  Conectado como <span className="font-medium">@{connection.username}</span>
                </p>
                <p className="text-xs text-ink/50">
                  {connection.account_type} · conectado el{" "}
                  {new Date(connection.connected_at).toLocaleDateString("es-CO")}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/marca/panel/import"
                  className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep"
                >
                  Importar fotos →
                </Link>
                <form action={disconnectInstagram}>
                  <button className="rounded-full bg-coral/15 px-4 py-2 text-sm font-medium text-coral hover:bg-coral/25">
                    Desconectar
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <a
              href="/api/instagram/authorize"
              className="inline-block rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-forest-deep"
            >
              Conectar con Instagram
            </a>
          )}
        </GlassCard>

        {/* Perfil */}
        <GlassCard className="mt-6 p-6">
          <h2 className="mb-4 text-lg font-medium text-forest">Perfil</h2>
          <form action={updateBrandProfile} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={label}>Nombre</label>
              <input className={input} name="name" defaultValue={brand.name} required />
            </div>
            <div>
              <label className={label}>URL tienda</label>
              <input
                className={input}
                name="store_url"
                defaultValue={brand.store_url ?? ""}
                placeholder="https://"
              />
            </div>
            <div>
              <label className={label}>Instagram</label>
              <input
                className={input}
                name="instagram"
                defaultValue={brand.instagram ?? ""}
                placeholder="marca.co"
              />
            </div>
            <div className="col-span-2">
              <label className={label}>Bio</label>
              <input className={input} name="bio" defaultValue={brand.bio ?? ""} />
            </div>
            <div className="col-span-2">
              <button className={submit} type="submit">
                Guardar
              </button>
            </div>
          </form>
        </GlassCard>

        {/* Catálogo */}
        <GlassCard className="mt-6 p-6">
          <h2 className="mb-4 text-lg font-medium text-forest">
            Catálogo ({garments?.length ?? 0})
          </h2>
          {garments?.length ? (
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {garments.map((g) => {
                const img = imageUrl(gImageMap.get(g.id));
                return (
                  <div key={g.id} className="glass-input rounded-xl p-2">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={g.title}
                        className="mb-2 aspect-square w-full rounded-lg object-cover"
                      />
                    )}
                    <p className="truncate text-xs font-medium text-ink">{g.title}</p>
                    {g.price_cop != null && (
                      <p className="text-xs text-ink/60">{formatCop(g.price_cop)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mb-5 text-sm text-ink/50">Aún no tienes prendas en tu catálogo.</p>
          )}

          <details>
            <summary className="cursor-pointer text-sm font-medium text-forest">
              + Nueva prenda
            </summary>
            <form action={createBrandGarment} className="mt-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={label}>Título</label>
                <input className={input} name="title" required />
              </div>
              <div>
                <label className={label}>Precio (COP)</label>
                <input className={input} name="price_cop" type="number" min="0" />
              </div>
              <div>
                <label className={label}>Categoría</label>
                <select className={input} name="category" defaultValue="">
                  <option value="">—</option>
                  {(categories ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>URL producto</label>
                <input className={input} name="product_url" placeholder="https://" />
              </div>
              <div>
                <label className={label}>Color</label>
                <input className={input} name="color" />
              </div>
              <div className="col-span-2">
                <label className={label}>Descripción</label>
                <textarea className={input} name="description" rows={2} />
              </div>
              <div className="col-span-2">
                <label className={label}>Tallas</label>
                <div className="flex flex-wrap gap-2">
                  {(sizes ?? []).map((s) => (
                    <label key={s.id} className="flex items-center gap-1 text-xs text-ink/70">
                      <input type="checkbox" name="sizes" value={s.id} /> {s.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className={label}>Foto</label>
                <input className={input} name="image" type="file" accept="image/*" required />
              </div>
              <div className="col-span-2">
                <button className={submit} type="submit">
                  Agregar prenda
                </button>
              </div>
            </form>
          </details>
        </GlassCard>

        {/* Posts */}
        <GlassCard className="mt-6 mb-12 p-6">
          <h2 className="mb-4 text-lg font-medium text-forest">
            Looks ({posts?.length ?? 0})
          </h2>
          {posts?.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {posts.map((p) => {
                const img = imageUrl(pImageMap.get(p.id));
                const items = itemCounts.get(p.id) ?? 0;
                return (
                  <Link
                    key={p.id}
                    href={`/marca/panel/post/${p.id}`}
                    className="glass-input block rounded-xl p-2 hover:bg-white/70"
                  >
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={p.caption ?? "look"}
                        className="mb-2 aspect-[3/4] w-full rounded-lg object-cover"
                      />
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          p.status === "published"
                            ? "bg-leaf-soft text-forest-deep"
                            : "bg-ink/10 text-ink/60"
                        }`}
                      >
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                      <span className="text-[10px] text-ink/50">{items} prenda(s)</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-ink/50">
              Aún no tienes looks. Importa fotos desde Instagram o sube una manualmente.
            </p>
          )}
        </GlassCard>
      </div>
    </>
  );
}
