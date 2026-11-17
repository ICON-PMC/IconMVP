import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  HeartIcon,
  ImageIcon,
  LockIcon,
  PlusIcon,
  ShirtIcon,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FeedGrid } from "@/components/feed-grid";
import { LinkTabs } from "@/components/link-tabs";
import { Button } from "@/components/ui/button";
import { ProfileHeader } from "@/components/profile/profile-header";
import { getCurrentUser } from "@/lib/auth";
import { getFeedOptions } from "@/lib/feed-options";
import {
  getProfile,
  getProfileTab,
  parseProfileTab,
  type ProfileTab,
} from "@/lib/profile";
import { getMySavedIds } from "@/lib/saves";
import { getMyLikedGarmentIds, getMyLikedPostIds } from "@/lib/social";
import { userLooksEnabled } from "@/lib/features";

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const res = await getProfile(handle);
  if (res.kind !== "profile" || !res.profile.isPublic || res.profile.isHidden) {
    return {
      title: "Perfil no disponible · Icon",
      robots: { index: false, follow: false },
    };
  }
  const p = res.profile;
  const title = `${p.displayName} (@${p.handle}) en Icon`;
  const description = p.bio ?? "Mira sus looks en Icon";
  return {
    title,
    description,
    openGraph: { title, description, url: `/u/${p.handle}`, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { handle } = await params;
  const { tab: tabRaw } = await searchParams;
  const res = await getProfile(handle);
  if (res.kind === "brand") redirect(`/marca/${res.slug}`);
  if (res.kind === "unavailable") notFound();
  const profile = res.profile;
  // URL canónica: el nombre de usuario en minúsculas.
  if (decodeURIComponent(handle) !== profile.handle)
    redirect(`/u/${profile.handle}${tabRaw ? `?tab=${tabRaw}` : ""}`);

  const showLikeTabs = profile.likesVisible || profile.isMe;
  let tab: ProfileTab = parseProfileTab(tabRaw);
  if (!showLikeTabs) tab = "looks";

  const [page, saved, likedPosts, likedGarments, session, options] =
    await Promise.all([
      getProfileTab(profile.id, tab, 0),
      getMySavedIds(),
      getMyLikedPostIds(),
      getMyLikedGarmentIds(),
      getCurrentUser(),
      getFeedOptions(),
    ]);
  const isLoggedIn = Boolean(session?.profile);
  const tagNames: Record<string, string> = {};
  for (const t of [...options.occasions, ...options.styles])
    tagNames[t.slug] = t.name;
  const path = `/u/${profile.handle}`;
  const likesPrivateNote = profile.isMe && !profile.likesVisible;

  const empty =
    tab === "looks" ? (
      profile.isMe ? (
        <EmptyState
          icon={ImageIcon}
          title="Aún no publicas looks"
          description="Comparte tu primer look: sube una foto y etiqueta lo que llevas."
          action={
            userLooksEnabled()
              ? { label: "Crear un look", href: "/crear" }
              : undefined
          }
        />
      ) : (
        <EmptyState
          icon={ImageIcon}
          title="Aún no hay looks"
          description={`Cuando ${profile.displayName} publique looks, aparecerán aquí.`}
        />
      )
    ) : tab === "prendas" ? (
      <EmptyState
        icon={ShirtIcon}
        title={
          profile.isMe
            ? "Aún no le das me gusta a prendas"
            : "Aún no hay prendas"
        }
        description={
          profile.isMe
            ? "Las prendas que te gusten aparecerán aquí."
            : "Las prendas que le gusten aparecerán aquí."
        }
      />
    ) : (
      <EmptyState
        icon={HeartIcon}
        title={
          profile.isMe ? "Aún no le das me gusta a looks" : "Aún no hay looks"
        }
        description={
          profile.isMe
            ? "Los looks que te gusten aparecerán aquí."
            : "Los looks que le gusten aparecerán aquí."
        }
      />
    );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
      <ProfileHeader profile={profile} isLoggedIn={isLoggedIn} />

      <LinkTabs
        label="Contenido del perfil"
        variant="underline"
        active={tab}
        className="mt-6 mb-4"
        tabs={[
          { id: "looks", label: "Looks", href: path },
          ...(showLikeTabs
            ? [
                {
                  id: "prendas",
                  label: "Prendas",
                  href: `${path}?tab=prendas`,
                },
                {
                  id: "me-gusta",
                  label: "Me gusta",
                  href: `${path}?tab=me-gusta`,
                },
              ]
            : []),
        ]}
      />
      {profile.isMe && tab === "looks" && userLooksEnabled() && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/crear" />}
            nativeButton={false}
          >
            <PlusIcon data-icon="inline-start" /> Borradores y nuevo look
          </Button>
        </div>
      )}

      {likesPrivateNote && tab !== "looks" && (
        <p className="mb-4 flex items-center gap-2 text-sm text-text-muted">
          <LockIcon className="size-4" aria-hidden /> Solo tú ves esto.{" "}
          <Link
            href="/settings#privacidad"
            className="font-semibold text-text underline underline-offset-2"
          >
            Mostrar lo que me gusta
          </Link>
        </p>
      )}

      <FeedGrid
        key={`${profile.id}:${tab}`}
        initialItems={page.items}
        initialNextOffset={page.nextOffset}
        initialSaved={saved}
        initialLiked={{ posts: likedPosts, garments: likedGarments }}
        isLoggedIn={isLoggedIn}
        tagNames={tagNames}
        emptyState={empty}
        apiQuery={{ profile: profile.id, tab }}
      />
    </div>
  );
}
