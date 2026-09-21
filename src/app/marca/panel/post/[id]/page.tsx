import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireBrandOwner } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { SiteHeader } from "@/components/site-header";
import { PageShell, SectionHeader } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { StickyActionBar } from "@/components/sticky-action-bar";
import { EmptyState } from "@/components/empty-state";
import { FlashToast } from "@/components/flash-toast";
import { Button } from "@/components/ui/button";
import { imageUrl } from "@/lib/images";
import { formatCop } from "@/lib/taxonomy";
import { publishPost, unpublishPost } from "../../actions";
import { GarmentPicker } from "./_components/garment-picker";
import { TaggedItems } from "./_components/tagged-items";
import { TagsForm } from "./_components/tags-form";

export default async function BrandPostEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    supabase.from("post_items").select("id, garment_id, size_id").eq("post_id", id),
    supabase.from("garments").select("id, title, price_cop").eq("brand_id", brand.id).order("title"),
    supabase.from("sizes").select("id, label").order("sort_order"),
    supabase.from("tags").select("id, name").eq("type", "occasion").order("name"),
    supabase.from("tags").select("id, name").eq("type", "style").order("name"),
    supabase.from("tags").select("id, name").eq("type", "temperature").order("name"),
    supabase.from("post_tags").select("tag_id").eq("post_id", id),
  ]);

  const garmentMap = new Map((myGarments ?? []).map((g) => [g.id, g]));
  const taggedIds = new Set((items ?? []).map((it) => it.garment_id));
  const img = imageUrl(images?.[0]?.cf_image_id);
  const isPublished = post.status === "published";

  const tagged = (items ?? []).map((it) => {
    const g = garmentMap.get(it.garment_id);
    return {
      id: it.id,
      title: g?.title ?? "(prenda)",
      price: g?.price_cop != null ? formatCop(g.price_cop) : null,
      sizeId: it.size_id,
    };
  });
  const pickable = (myGarments ?? [])
    .filter((g) => !taggedIds.has(g.id))
    .map((g) => ({
      id: g.id,
      label: g.title,
      hint: g.price_cop != null ? formatCop(g.price_cop) : undefined,
    }));

  // Por qué no se puede publicar (se muestra junto al botón en vez de fallar al pulsar).
  const blocker = isPublished
    ? null
    : brand.status !== "active"
      ? "Podrás publicar cuando tu marca sea aprobada."
      : !tagged.length
        ? "Taggea al menos una prenda para publicar."
        : null;

  return (
    <>
      <Aurora />
      <PageShell width="2xl">
        <SiteHeader />
        <Suspense>
          <FlashToast />
        </Suspense>

        <Link
          href="/marca/panel?tab=looks"
          className="mt-6 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-ink/70 hover:text-forest"
        >
          <ChevronLeftIcon className="size-4" /> Looks
        </Link>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-medium tracking-tight text-forest">Editar look</h1>
          <StatusBadge status={post.status} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div>
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={post.caption ?? "Foto del look"}
                className="mx-auto max-h-[60dvh] w-full rounded-2xl object-cover md:sticky md:top-6 md:max-h-none"
              />
            )}
            {post.caption && <p className="mt-2 text-sm text-ink/70">{post.caption}</p>}
          </div>

          <div className="space-y-6">
            <GlassCard className="p-5">
              <SectionHeader
                title={`1 · Prendas (${tagged.length})`}
                description="Las prendas que se ven en la foto."
              />
              <div className="mt-4 space-y-4">
                {tagged.length ? (
                  <TaggedItems
                    postId={id}
                    items={tagged}
                    sizes={sizes ?? []}
                    wasPublished={isPublished}
                  />
                ) : (
                  <EmptyState
                    title="Aún no hay prendas"
                    description="Taggea al menos una para poder publicar."
                  />
                )}
                <GarmentPicker postId={id} options={pickable} />
                {!pickable.length && (
                  <p className="text-xs text-ink/60">
                    {myGarments?.length
                      ? "Ya taggeaste todo tu catálogo en este look."
                      : "Agrega prendas a tu catálogo primero."}
                  </p>
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <SectionHeader
                title="2 · Ocasión, estilo y clima"
                description="Ayudan a que te encuentren por intención."
              />
              <div className="mt-4">
                <TagsForm
                  postId={id}
                  occasions={occasions ?? []}
                  styles={styles ?? []}
                  temperatures={temperatures ?? []}
                  selected={(myTags ?? []).map((t) => t.tag_id)}
                />
              </div>
            </GlassCard>
          </div>
        </div>
      </PageShell>

      <StickyActionBar label={blocker ?? undefined}>
        <form action={(isPublished ? unpublishPost : publishPost).bind(null, id)} className="w-full sm:w-auto">
          <Button
            type="submit"
            size="lg"
            variant={isPublished ? "outline" : "default"}
            disabled={!!blocker}
            className="w-full rounded-full sm:w-auto sm:px-8"
          >
            {isPublished ? "Despublicar" : "Publicar look"}
          </Button>
        </form>
      </StickyActionBar>
    </>
  );
}
