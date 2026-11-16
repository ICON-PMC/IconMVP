import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, BadgeCheckIcon, CircleAlertIcon } from "lucide-react";
import { R2Image } from "@/components/r2-image";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { FlashToast } from "@/components/flash-toast";
import { SaveButton } from "@/components/save-button";
import { LikeButton } from "@/components/like-button";
import { AuthorChip } from "@/components/looks/author-chip";
import { LookItems } from "@/components/looks/look-items";
import { ReportSheet } from "@/components/looks/report-sheet";
import { getLookDetail } from "@/lib/looks";
import { getMySavedIds } from "@/lib/saves";
import { getMyLikedPostIds } from "@/lib/social";
import { getCurrentUser } from "@/lib/auth";
import { userLooksEnabled } from "@/lib/features";
import { priceLabel } from "@/lib/taxonomy";
import { LookOwnerActions } from "./owner-actions";

const FLASH = { publicado: "¡Publicaste tu look! Ya está en el feed." };

// Ficha de look (spec 007 US4 + spec 008 T029): sirve looks de marca y de usuario. Fotos con su
// proporción, quien lo publica, texto (plano), etiquetas y lo etiquetado: prendas de catálogo con su
// botón a la tienda, prendas propuestas "Sin verificar" y marcas mencionadas.
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const look = await getLookDetail(id);
  if (!look) notFound();

  const [saved, likedPostIds, session] = await Promise.all([getMySavedIds(), getMyLikedPostIds(), getCurrentUser()]);
  const path = `/post/${id}`;
  const isLoggedIn = Boolean(session?.profile);
  const author = look.author;
  const authorName = author?.kind === "user" ? author.profile.displayName : author?.kind === "brand" ? author.name : "Icon";
  const prices = look.garments.flatMap((g) => (g.available && g.priceCop != null ? [g.priceCop] : []));
  const price = prices.length ? priceLabel(Math.min(...prices), Math.max(...prices)) : null;
  const isUserLook = author?.kind === "user";
  const canReport = userLooksEnabled() && isLoggedIn && !look.isMine && look.status === "published";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
      <Suspense>
        <FlashToast messages={FLASH} />
      </Suspense>
      <Link href="/feed" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-action-text hover:underline">
        <ArrowLeftIcon className="size-4" aria-hidden /> Volver al feed
      </Link>

      {look.status !== "published" && (
        <div role="status" className="mb-4 flex gap-3 rounded-[var(--radius-card)] bg-surface-sunken p-4 text-sm text-text">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            {look.moderationLocked
              ? "El equipo de Icon retiró este look. Solo tú lo ves."
              : look.hiddenReason === "auto"
                ? "Este look está oculto mientras el equipo revisa unos reportes. Solo tú lo ves."
                : "Este look es un borrador. Solo tú lo ves."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10">
        <div className="flex flex-col gap-3">
          {look.images.map((img, idx) => (
            <div
              key={img.id}
              className="overflow-hidden rounded-[var(--radius-card)] bg-surface-sunken"
              style={{ aspectRatio: img.width && img.height ? `${img.width} / ${img.height}` : "4 / 5" }}
            >
              <R2Image
                image={img.key}
                alt={idx === 0 ? (look.caption ?? `Look de ${authorName}`) : `Foto ${idx + 1} del look de ${authorName}`}
                sizes="(min-width: 1152px) 640px, (min-width: 768px) 58vw, 100vw"
                priority={idx === 0}
                className="size-full object-cover"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-5 md:sticky md:top-24 md:self-start">
          <div className="flex items-start justify-between gap-3">
            {author?.kind === "user" ? (
              <AuthorChip profile={author.profile} />
            ) : (
              <div className="flex items-center gap-3">
                <Avatar image={author?.kind === "brand" ? author.logo : null} name={authorName} seed={author?.kind === "brand" ? author.id : id} size={48} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1 font-semibold text-text">
                    {author?.kind === "brand" ? (
                      <Link href={`/marca/${author.slug}`} className="hover:underline">
                        {author.name}
                      </Link>
                    ) : (
                      authorName
                    )}
                    {author?.kind === "brand" && author.verified && <BadgeCheckIcon className="size-4 text-forest" aria-label="verificada" />}
                  </p>
                  {author?.kind === "brand" && author.city && <p className="text-[13px] text-text-muted">{author.city}</p>}
                </div>
              </div>
            )}
            {look.status === "published" && (
              <div className="flex items-center gap-2">
                <SaveButton kind="post" id={id} saved={saved.posts.has(id)} path={path} />
                <LikeButton itemId={id} initialLiked={likedPostIds.has(id)} initialCount={look.likeCount} path={path} isLoggedIn={isLoggedIn} />
              </div>
            )}
          </div>

          {look.caption && <p className="text-[17px] leading-7 whitespace-pre-line text-text">{look.caption}</p>}
          {price && <p className="text-sm font-semibold text-text-muted">{price}</p>}
          {look.tags.length > 0 && (
            <ul className="flex flex-wrap gap-x-2" aria-label="Estilo y ocasión">
              {look.tags.map((t) => (
                <li key={t.id}>
                  <Chip variant="tag">{t.name}</Chip>
                </li>
              ))}
            </ul>
          )}

          {(look.garments.length > 0 || look.proposed.length > 0 || look.mentions.length > 0) && (
            <section aria-labelledby="look-items">
              <h2 id="look-items" className="mb-3 text-h3 text-text">
                {isUserLook ? "Lo que lleva" : "Prendas en este look"}
              </h2>
              <LookItems postId={id} garments={look.garments} proposed={look.proposed} mentions={look.mentions} mode="view" savedGarmentIds={[...saved.garments]} path={path} />
            </section>
          )}

          {(look.isMine || canReport) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              {look.isMine && <LookOwnerActions postId={id} canEdit={userLooksEnabled() && !look.moderationLocked} />}
              {canReport && <ReportSheet targetType="post" targetId={id} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
