import { notFound, redirect } from "next/navigation";
import { CircleAlertIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { userLooksEnabled } from "@/lib/features";
import { getMyLook, LOOK_LIMITS, MISSING_SHORT, missingToPublish } from "@/lib/looks";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StickyActionBar } from "@/components/sticky-action-bar";
import { Badge } from "@/components/ui/badge";
import { PhotoUploader } from "@/components/looks/photo-uploader";
import { StyleOccasionFields } from "@/components/looks/style-occasion-fields";
import { LookItems } from "@/components/looks/look-items";
import { getLookTagStatus } from "@/lib/claims";
import { CaptionField, PublishActions, TagButton } from "./look-editor-parts";

export const metadata = { title: "Editar look · Icon" };

const STATUS = { draft: "Borrador", published: "Publicado", archived: "Oculto" } as const;

// Editor de un look de usuario (spec 008, US1): Fotos, Prendas y marcas, Estilo y ocasión, Texto.
// Cada cambio se guarda al momento; "Publicar" queda fijo abajo y explica lo que falta.
export default async function LookEditorPage({ params }: { params: Promise<{ id: string }> }) {
  if (!userLooksEnabled()) notFound();
  const { id } = await params;
  const session = await getCurrentUser();
  if (!session?.profile) redirect(`/login?next=/crear/${id}`);
  if (session.profile.role === "brand") redirect("/marca/panel?tab=looks");

  const look = await getMyLook(id);
  if (!look) notFound();

  const supabase = await createClient();
  const [{ data: tags }, { data: colors }, { data: counts }, tagStatus] = await Promise.all([
    supabase.from("tags").select("id, name, slug, type").eq("is_hidden", false).in("type", ["style", "occasion", "category"]).order("name"),
    supabase.from("colors").select("id, name, hex").eq("is_hidden", false).order("position").order("name"),
    supabase.rpc("feed_style_counts"),
    getLookTagStatus(id),
  ]);
  const uses = new Map((counts ?? []).map((c) => [c.slug, c.uses]));
  const byType = (t: string) => (tags ?? []).filter((x) => x.type === t);
  // Estilos populares primero (los más usados en el feed), luego alfabético.
  const styles = byType("style")
    .sort((a, b) => (uses.get(b.slug) ?? 0) - (uses.get(a.slug) ?? 0) || a.name.localeCompare(b.name, "es"))
    .map(({ id, name }) => ({ id, name }));
  const occasions = byType("occasion").map(({ id, name }) => ({ id, name }));
  const categories = byType("category").map(({ id, name }) => ({ id, name }));

  const locked = look.moderationLocked;
  const missing = missingToPublish(look);
  const tagCount = look.garments.length + look.proposed.length + look.mentions.length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5 pb-40 md:px-6">
      <PageHeader
        title={look.status === "published" ? "Editar look" : "Nuevo look"}
        back={{ href: "/crear", label: "Tus looks" }}
        actions={<Badge variant={look.status === "published" ? "verified" : "neutral"}>{STATUS[look.status]}</Badge>}
      />

      {locked && (
        <div role="alert" className="mb-6 flex gap-3 rounded-[var(--radius-card)] bg-surface-sunken p-4 text-sm text-text">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <p>
            El equipo de Icon retiró este look{look.hiddenReason ? `: ${look.hiddenReason}` : ""}. No se puede editar ni
            volver a publicar; puedes borrarlo.
          </p>
        </div>
      )}
      {!locked && look.hiddenReason === "auto" && (
        <div role="status" className="mb-6 flex gap-3 rounded-[var(--radius-card)] bg-surface-sunken p-4 text-sm text-text">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Ocultamos este look mientras el equipo revisa unos reportes. Te avisaremos de lo que decida.</p>
        </div>
      )}

      <div className="flex flex-col gap-10">
        <section aria-labelledby="sec-fotos" className="flex flex-col gap-3">
          <h2 id="sec-fotos" className="text-h3 text-text">
            Fotos
          </h2>
          <PhotoUploader postId={look.id} images={look.images} max={LOOK_LIMITS.photos} disabled={locked} />
        </section>

        <section aria-labelledby="sec-prendas" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="sec-prendas" className="text-h3 text-text">
              Prendas y marcas
            </h2>
            <span className="text-[13px] text-text-muted tabular-nums">
              {tagCount} de {LOOK_LIMITS.items}
            </span>
          </div>
          {tagStatus.notes.length > 0 && (
            <div role="status" className="flex flex-col gap-1.5 rounded-[var(--radius-card)] bg-surface-sunken p-4 text-sm text-text">
              <p className="font-semibold">Avisos</p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {tagStatus.notes.slice(0, 5).map((n, i) => (
                  <li key={i}>{n.text}</li>
                ))}
              </ul>
            </div>
          )}
          <LookItems
            postId={look.id}
            garments={look.garments}
            proposed={look.proposed}
            mentions={look.mentions}
            mode={locked ? "view" : "edit"}
            tagStatus={look.status === "published" ? tagStatus : undefined}
          />
          {!locked && (
            <div>
              <TagButton
                postId={look.id}
                categories={categories}
                colors={colors ?? []}
                taggedGarmentIds={look.garments.map((g) => g.garmentId)}
                count={tagCount}
              />
            </div>
          )}
        </section>

        <section aria-labelledby="sec-estilo" className="flex flex-col gap-3">
          <h2 id="sec-estilo" className="text-h3 text-text">
            Estilo y ocasión
          </h2>
          <StyleOccasionFields
            postId={look.id}
            styles={styles}
            occasions={occasions}
            selectedStyleIds={look.styleIds}
            selectedOccasionIds={look.occasionIds}
            disabled={locked}
          />
        </section>

        <section aria-labelledby="sec-texto">
          <h2 id="sec-texto" className="sr-only">
            Texto
          </h2>
          <CaptionField postId={look.id} initial={look.caption ?? ""} disabled={locked} />
        </section>
      </div>

      <StickyActionBar
        stackAboveNav
        label={
          look.status !== "published" && !locked && missing.length
            ? `Falta: ${missing.map((m) => MISSING_SHORT[m]).join(", ")}`
            : undefined
        }
      >
        <PublishActions postId={look.id} status={look.status} missing={missing} locked={locked} />
      </StickyActionBar>
    </main>
  );
}
