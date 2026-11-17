import Link from "next/link";
import { ArrowUpRightIcon, EyeOffIcon, LinkIcon, LockIcon, MapPinIcon, PencilIcon, SettingsIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { ReportSheet } from "@/components/looks/report-sheet";
import { FollowerCount } from "@/components/profile/follower-count";
import { ShareButton } from "@/components/profile/share-button";
import { UserFollowButton } from "@/components/profile/user-follow-button";
import { coverClass, linkDomain } from "@/lib/profile-rules";
import type { Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";

/**
 * Cabecera del perfil de una persona (spec 009). Misma estructura que la de la página de marca
 * (spec 007): portada, avatar de 96 px, nombre, @usuario, bio, ciudad, enlace, contadores y acciones.
 */
export function ProfileHeader({ profile, isLoggedIn }: { profile: Profile; isLoggedIn: boolean }) {
  const path = `/u/${profile.handle}`;
  const followingCount = (
    <>
      <strong className="font-semibold text-text">{profile.counts.following}</strong> {profile.counts.following === 1 ? "seguido" : "seguidos"}
    </>
  );
  return (
    <header className="surface overflow-hidden">
      <div className={cn("h-20 md:h-28", coverClass(profile.id))} aria-hidden />
      <div className="px-5 pb-5 md:px-8 md:pb-7">
        <div className="flex items-end justify-between gap-3">
          <Avatar
            image={profile.avatar}
            name={profile.displayName}
            seed={profile.id}
            size={96}
            priority
            className="-mt-12 border-4 border-surface-raised bg-surface-raised"
          />
          {profile.isMe && (
            <Link
              href="/settings"
              aria-label="Ajustes"
              className="inline-flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:outline-none"
            >
              <SettingsIcon className="size-5" aria-hidden />
            </Link>
          )}
        </div>
        <h1 className="mt-3 text-h1 break-words text-text">{profile.displayName}</h1>
        <p className="text-sm text-text-muted">@{profile.handle}</p>
        {profile.bio && <p className="mt-3 max-w-2xl text-[15px] leading-6 whitespace-pre-line text-text">{profile.bio}</p>}
        {(profile.cityName || profile.linkUrl) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
            {profile.cityName && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-4" aria-hidden /> {profile.cityName}
              </span>
            )}
            {profile.linkUrl && (
              <a
                href={profile.linkUrl}
                target="_blank"
                rel="nofollow ugc noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-text underline-offset-2 hover:underline"
              >
                <LinkIcon className="size-4" aria-hidden /> {linkDomain(profile.linkUrl)}
                <ArrowUpRightIcon className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        )}
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-muted" aria-label="Contadores">
          <li>
            <strong className="font-semibold text-text">{profile.counts.looks}</strong> {profile.counts.looks === 1 ? "look" : "looks"}
          </li>
          <li>
            <FollowerCount userId={profile.id} initial={profile.counts.followers} />
          </li>
          <li>
            {profile.isMe ? (
              <Link href="/siguiendo" className="underline-offset-2 hover:underline">
                {followingCount}
              </Link>
            ) : (
              followingCount
            )}
          </li>
        </ul>

        {profile.isMe && (!profile.isPublic || profile.isHidden) && (
          <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-card)] bg-surface-sunken p-3 text-sm text-text">
            {profile.isHidden ? <EyeOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span>
              {profile.isHidden
                ? `El equipo de Icon ocultó tu perfil${profile.hiddenReason ? `: ${profile.hiddenReason}` : ""}. Solo tú lo ves. Escríbenos si crees que es un error.`
                : "Tu perfil es privado: solo tú lo ves. Puedes cambiarlo en "}
              {!profile.isHidden && (
                <Link href="/settings#privacidad" className="font-semibold underline underline-offset-2">
                  Privacidad
                </Link>
              )}
              {!profile.isHidden && "."}
            </span>
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {profile.isMe ? (
            <Button variant="secondary" render={<Link href={`${path}/editar`} />} nativeButton={false}>
              <PencilIcon data-icon="inline-start" /> Editar perfil
            </Button>
          ) : (
            <UserFollowButton userId={profile.id} initialFollowing={profile.iFollow} isLoggedIn={isLoggedIn} loginNext={path} />
          )}
          {profile.isPublic && !profile.isHidden && <ShareButton url={path} title={`${profile.displayName} (@${profile.handle}) en Icon`} />}
          {!profile.isMe && isLoggedIn && <ReportSheet targetType="profile" targetId={profile.id} />}
        </div>
      </div>
    </header>
  );
}
