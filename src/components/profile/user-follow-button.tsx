"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { UserCheck, UserPlus } from "lucide-react";
import { followUser, unfollowUser } from "@/app/(app)/u/[handle]/actions";
import { cn } from "@/lib/utils";

export const FOLLOW_EVENT = "icon:user-follow";
export type FollowEventDetail = { userId: string; delta: 1 | -1 };

/** Seguir / Siguiendo a una persona (spec 009). Optimista; avisa al contador de la cabecera. */
export function UserFollowButton({
  userId,
  initialFollowing,
  isLoggedIn,
  loginNext,
  size = "md",
}: {
  userId: string;
  initialFollowing: boolean;
  isLoggedIn: boolean;
  /** Ruta a la que volver después de iniciar sesión. */
  loginNext: string;
  size?: "md" | "sm";
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const box = cn(
    "inline-flex items-center gap-2 rounded-full font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-line-strong disabled:opacity-60",
    size === "md" ? "min-h-11 px-5 text-sm" : "min-h-9 px-3.5 text-[13px]",
  );

  if (!isLoggedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className={cn(box, "bg-surface-inverse text-text-inverse hover:opacity-90")}>
        <UserPlus className="size-4" aria-hidden /> Seguir
      </Link>
    );
  }

  function toggle() {
    const next = !following;
    setFollowing(next);
    setError(null);
    const emit = (delta: 1 | -1) =>
      window.dispatchEvent(new CustomEvent<FollowEventDetail>(FOLLOW_EVENT, { detail: { userId, delta } }));
    emit(next ? 1 : -1);
    startTransition(async () => {
      const res = next ? await followUser(userId) : await unfollowUser(userId);
      if (!res.ok) {
        setFollowing(!next);
        emit(next ? -1 : 1);
        setError(res.error);
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className={cn(
          box,
          following ? "border-[1.5px] border-line-strong text-text hover:bg-surface-sunken" : "bg-surface-inverse text-text-inverse hover:opacity-90",
        )}
      >
        {following ? <UserCheck className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
        {following ? "Siguiendo" : "Seguir"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
