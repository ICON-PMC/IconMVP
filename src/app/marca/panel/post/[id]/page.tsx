import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireBrandOwner } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { SiteHeader } from "@/components/site-header";
import { imageUrl } from "@/lib/images";
import { formatCop } from "@/lib/taxonomy";
import {
  tagGarmentOnPost,
  untagGarmentFromPost,
  setPostTags,
  publishPost,
  unpublishPost,
} from "../../actions";

const input =
  "glass-input w-full rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink/40";
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-ink/50";
const chip =
  "glass-input cursor-pointer rounded-full px-3 py-1 text-xs text-ink/80 peer-checked:bg-forest peer-checked:text-white";
const submit =
  "rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-forest-deep";

export default async function BrandPostEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { brand } = await requireBrandOwner();
  if (!brand) notFound();

  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id, caption, status, author_brand_id")
    .eq("id", id)
    .maybeSingle();
  if (!post || post.author_brand_id !== brand.id) notFound();

  const [
    { data: images },
    { data: items },
    { data: myGarments },
    { data: sizes },
    { data: occasions },
    { data: styles },
    { data: temperatures },
    { data: myTags },
  ] = await Promise.all([
    supabase.from("post_images").select("cf_image_id").eq("post_id", id).order("position"),
    supabase
      .from("post_items")
      .select("id, garment_id, size_id")
      .eq("post_id", id),
    supabase
      .from("garments")
      .select("id, title, price_cop")
      .eq("brand_id", brand.id)
      .order("title"),
    supabase.from("sizes").select("id, label").order("sort_order"),
    supabase.from("tags").select("id, name").eq("type", "occasion").order("name"),
    supabase.from("tags").select("id, name").eq("type", "style").order("name"),
    supabase.from("tags").select("id, name").eq("type", "temperature").order("name"),
    supabase.from("post_tags").select("tag_id").eq("post_id", id),
  ]);

  const garmentMap = new Map((myGarments ?? []).map((g) => [g.id, g]));
  const sizeMap = new Map((sizes ?? []).map((s) => [s.id, s.label]));
  const selectedTagIds = new Set((myTags ?? []).map((t) => t.tag_id));
  const img = imageUrl(images?.[0]?.cf_image_id);
  const untaggedGarments = (myGarments ?? []).filter(
    (g) => !(items ?? []).some((it) => it.garment_id === g.id),
  );

  return (
    <>
      <Aurora />
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <SiteHeader />
        <div className="mt-8 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-medium tracking-tight text-forest">Editar look</h1>
          <form action={(post.status === "published" ? unpublishPost : publishPost).bind(null, id)}>
            <button
              className={
                post.status === "published"
                  ? "rounded-full bg-ink/10 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/15"
                  : submit
              }
            >
              {post.status === "published" ? "Despublicar" : "Publicar"}
            </button>
          </form>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">{error}</p>
        )}

        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="w-full rounded-2xl object-cover" />
            )}
            {post.caption && <p className="mt-2 text-sm text-ink/70">{post.caption}</p>}
          </div>

          <div>
            <GlassCard className="p-4">
              <h2 className="mb-3 text-sm font-medium text-forest">
                Prendas taggeadas ({items?.length ?? 0})
              </h2>
              {items?.length ? (
                <ul className="mb-4 space-y-2">
                  {items.map((it) => {
                    const g = garmentMap.get(it.garment_id);
                    return (
                      <li
                        key={it.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white/60 px-3 py-2 text-sm"
                      >
                        <span className="truncate">
                          {g?.title ?? "(prenda)"}
                          {it.size_id && (
                            <span className="text-ink/50"> · {sizeMap.get(it.size_id)}</span>
                          )}
                          {g?.price_cop != null && (
                            <span className="text-ink/50"> · {formatCop(g.price_cop)}</span>
                          )}
                        </span>
                        <form action={untagGarmentFromPost.bind(null, id, it.id)}>
                          <button className="text-xs font-medium text-coral hover:underline">
                            Quitar
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mb-4 text-xs text-ink/50">
                  Sin prendas todavía. Taggea al menos una para poder publicar.
                </p>
              )}

              {untaggedGarments.length ? (
                <form action={tagGarmentOnPost} className="flex flex-col gap-2">
                  <input type="hidden" name="post_id" value={id} />
                  <select className={input} name="garment_id" required defaultValue="">
                    <option value="" disabled>
                      Elige una prenda
                    </option>
                    {untaggedGarments.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                  <select className={input} name="size_id" defaultValue="">
                    <option value="">Talla (opcional)</option>
                    {(sizes ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-full bg-forest/10 px-4 py-2 text-xs font-medium text-forest hover:bg-forest/20">
                    + Taggear prenda
                  </button>
                </form>
              ) : (
                <p className="text-xs text-ink/40">
                  {myGarments?.length
                    ? "Ya taggeaste todo tu catálogo en este look."
                    : "Agrega prendas a tu catálogo primero."}
                </p>
              )}
            </GlassCard>
          </div>
        </div>

        <GlassCard className="mt-6 mb-12 p-6">
          <h2 className="mb-4 text-sm font-medium text-forest">Ocasión, estilo y clima</h2>
          <form action={setPostTags} className="flex flex-col gap-4">
            <input type="hidden" name="post_id" value={id} />
            <ChipGroup legend="Ocasión" name="occasions" options={occasions ?? []} selected={selectedTagIds} />
            <ChipGroup legend="Estilo" name="styles" options={styles ?? []} selected={selectedTagIds} />
            <ChipGroup legend="Temperatura" name="temperatures" options={temperatures ?? []} selected={selectedTagIds} />
            <div>
              <button className={submit} type="submit">
                Guardar etiquetas
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </>
  );
}

function ChipGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: { id: string; name: string }[];
  selected: Set<string>;
}) {
  return (
    <div>
      <label className={label}>{legend}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.id}>
            <input
              type="checkbox"
              name={name}
              value={o.id}
              defaultChecked={selected.has(o.id)}
              className="peer sr-only"
            />
            <span className={chip}>{o.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

