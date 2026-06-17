import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { PRICE_BUCKETS } from "@/lib/taxonomy";
import { SiteHeader } from "@/components/site-header";
import { createBrand, createGarment, createPost } from "./actions";

const input =
  "glass-input w-full rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink/40";
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-ink/50";
const chip =
  "glass-input cursor-pointer rounded-full px-3 py-1 text-xs text-ink/80 peer-checked:bg-forest peer-checked:text-white";
const submit =
  "rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-forest-deep";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login?next=/admin");
  if (!isStaff(session.profile)) redirect("/");
  const { ok, error } = await searchParams;

  const supabase = await createClient();
  const [
    { count: brandCount },
    { count: garmentCount },
    { count: postCount },
    { data: cities },
    { data: categories },
    { data: occasions },
    { data: styles },
    { data: temperatures },
    { data: sizes },
    { data: brands },
    { data: garments },
  ] = await Promise.all([
    supabase.from("brands").select("*", { count: "exact", head: true }),
    supabase.from("garments").select("*", { count: "exact", head: true }),
    supabase.from("posts").select("*", { count: "exact", head: true }),
    supabase.from("cities").select("id, name").order("name"),
    supabase.from("tags").select("id, name").eq("type", "category").order("name"),
    supabase.from("tags").select("id, name").eq("type", "occasion").order("name"),
    supabase.from("tags").select("id, name").eq("type", "style").order("name"),
    supabase.from("tags").select("id, name").eq("type", "temperature").order("name"),
    supabase.from("sizes").select("id, label").order("sort_order"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("garments").select("id, title").order("created_at", { ascending: false }),
  ]);

  const metrics = [
    { label: "Marcas", value: brandCount ?? 0 },
    { label: "Prendas", value: garmentCount ?? 0 },
    { label: "Posts", value: postCount ?? 0 },
  ];

  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <SiteHeader />

        <h1 className="mt-8 text-3xl font-medium tracking-tight text-forest">
          Panel del equipo
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          {session.profile?.display_name ?? session.email} · {session.profile?.role}
        </p>

        {ok && (
          <p className="mt-4 rounded-xl bg-leaf-soft px-3 py-2 text-sm text-forest-deep">
            ✓ {ok} creada/o correctamente.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
            {error}
          </p>
        )}

        {/* Métricas */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          {metrics.map((m) => (
            <GlassCard key={m.label} className="p-4 text-center">
              <p className="text-3xl font-medium text-forest">{m.value}</p>
              <p className="text-xs uppercase tracking-wide text-ink/50">{m.label}</p>
            </GlassCard>
          ))}
        </div>

        {/* Crear marca */}
        <GlassCard className="mt-8 p-6">
          <h2 className="mb-4 text-lg font-medium text-forest">Nueva marca</h2>
          <form action={createBrand} className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Nombre</label>
              <input className={input} name="name" required />
            </div>
            <div>
              <label className={label}>Slug</label>
              <input className={input} name="slug" required placeholder="mi-marca" />
            </div>
            <div>
              <label className={label}>Ciudad</label>
              <select className={input} name="city_id" defaultValue="">
                <option value="">—</option>
                {(cities ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Rango de precio</label>
              <select className={input} name="price_range" defaultValue="">
                <option value="">—</option>
                {PRICE_BUCKETS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>URL tienda</label>
              <input className={input} name="store_url" placeholder="https://" />
            </div>
            <div>
              <label className={label}>Instagram</label>
              <input className={input} name="instagram" placeholder="marca.co" />
            </div>
            <div className="col-span-2">
              <label className={label}>Bio</label>
              <input className={input} name="bio" />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input type="checkbox" name="is_verified" /> Verificada
            </label>
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input type="checkbox" name="is_sustainable" /> Sostenible
            </label>
            <div className="col-span-2">
              <button className={submit} type="submit">
                Crear marca
              </button>
            </div>
          </form>
        </GlassCard>

        {/* Crear prenda */}
        <GlassCard className="mt-6 p-6">
          <h2 className="mb-4 text-lg font-medium text-forest">Nueva prenda</h2>
          <form action={createGarment} className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Marca</label>
              <select className={input} name="brand_id" required defaultValue="">
                <option value="" disabled>
                  Elige marca
                </option>
                {(brands ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Título</label>
              <input className={input} name="title" required />
            </div>
            <div>
              <label className={label}>Precio (COP)</label>
              <input className={input} name="price_cop" type="number" min="0" />
            </div>
            <div>
              <label className={label}>URL producto</label>
              <input className={input} name="product_url" placeholder="https://" />
            </div>
            <div>
              <label className={label}>Color</label>
              <input className={input} name="color" />
            </div>
            <div>
              <label className={label}>Tela</label>
              <input className={input} name="fabric" />
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
              <label className={label}>Estado</label>
              <select className={input} name="status" defaultValue="published">
                <option value="published">published</option>
                <option value="pending">pending</option>
                <option value="archived">archived</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={label}>Tallas</label>
              <div className="flex flex-wrap gap-2">
                {(sizes ?? []).map((s) => (
                  <label key={s.id}>
                    <input
                      type="checkbox"
                      name="sizes"
                      value={s.id}
                      className="peer sr-only"
                    />
                    <span className={chip}>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className={label}>Foto</label>
              <input className={input} name="image" type="file" accept="image/*" />
            </div>
            <div className="col-span-2">
              <button className={submit} type="submit">
                Crear prenda
              </button>
            </div>
          </form>
        </GlassCard>

        {/* Crear post */}
        <GlassCard className="mt-6 mb-12 p-6">
          <h2 className="mb-4 text-lg font-medium text-forest">Nuevo post (look)</h2>
          <form action={createPost} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Marca autora</label>
                <select className={input} name="author_brand_id" required defaultValue="">
                  <option value="" disabled>
                    Elige marca
                  </option>
                  {(brands ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Estado</label>
                <select className={input} name="status" defaultValue="published">
                  <option value="published">published</option>
                  <option value="draft">draft</option>
                  <option value="archived">archived</option>
                </select>
              </div>
            </div>
            <div>
              <label className={label}>Caption</label>
              <input className={input} name="caption" />
            </div>

            <FieldChips legend="Ocasión" name="occasions" options={occasions ?? []} chip={chip} labelCls={label} />
            <FieldChips legend="Estilo" name="styles" options={styles ?? []} chip={chip} labelCls={label} />
            <FieldChips legend="Temperatura" name="temperatures" options={temperatures ?? []} chip={chip} labelCls={label} />

            <div>
              <label className={label}>Prendas en el look</label>
              <div className="flex flex-wrap gap-2">
                {(garments ?? []).map((g) => (
                  <label key={g.id}>
                    <input type="checkbox" name="garments" value={g.id} className="peer sr-only" />
                    <span className={chip}>{g.title}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={label}>Foto del look</label>
              <input className={input} name="image" type="file" accept="image/*" />
            </div>
            <div>
              <button className={submit} type="submit">
                Crear post
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </>
  );
}

function FieldChips({
  legend,
  name,
  options,
  chip,
  labelCls,
}: {
  legend: string;
  name: string;
  options: { id: string; name: string }[];
  chip: string;
  labelCls: string;
}) {
  return (
    <div>
      <label className={labelCls}>{legend}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.id}>
            <input type="checkbox" name={name} value={o.id} className="peer sr-only" />
            <span className={chip}>{o.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
