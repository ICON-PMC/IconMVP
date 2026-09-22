"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { UserPlus, UserCheck } from "lucide-react";
import { followBrand, unfollowBrand } from "@/app/marca/[slug]/actions";

// Botón Seguir / Siguiendo con UI optimista (Grupo 2 de specs/2026-09-22-user-social-actions).
//
// - Logueada: al clic cambia al instante y llama al server action; si falla, revierte y
//   muestra un mensaje inline (sin toast: no hay librería y no vale la pena para el piloto).
// - Anónima: renderiza un enlace a /login?next=/marca/[slug] (no hay acción que hacer).
// - Sin contador de seguidores (decisión 7).
export function FollowButton({
  brandId,
  slug,
  initialFollowing,
  isLoggedIn,
}: {
  brandId: string;
  slug: string;
  initialFollowing: boolean;
  isLoggedIn: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/marca/${slug}`)}`}
        className="glass-input inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-ink/80 hover:bg-white/70"
      >
        <UserPlus className="h-4 w-4" aria-hidden />
        Seguir
      </Link>
    );
  }

  function toggle() {
    const next = !following;
    setFollowing(next); // optimistic
    setError(null);
    startTransition(async () => {
      const res = next
        ? await followBrand(brandId, slug)
        : await unfollowBrand(brandId, slug);
      if (!res.ok) {
        setFollowing(!next); // rollback
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
        aria-label={following ? "Dejar de seguir" : "Seguir"}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
          following
            ? "glass-input text-forest hover:bg-white/70"
            : "bg-forest text-white hover:bg-forest-deep"
        }`}
      >
        {following ? (
          <UserCheck className="h-4 w-4" aria-hidden />
        ) : (
          <UserPlus className="h-4 w-4" aria-hidden />
        )}
        {following ? "Siguiendo" : "Seguir"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
