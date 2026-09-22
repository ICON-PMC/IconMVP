"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { likePost, unlikePost } from "@/app/post/[id]/actions";
import { likeGarment, unlikeGarment } from "@/app/prenda/[id]/actions";

// Botón de like con UI optimista (Grupo 3 de specs/2026-09-22-user-social-actions).
// Sirve para los dos tipos que muestra el feed (`kind` post | garment), igual que SaveButton.
//
// - El contador es visible SIN login (decisión 8); solo la acción exige sesión.
// - Logueada: el corazón se rellena y el contador se ajusta al instante; si falla, ambos
//   revierten y se muestra un mensaje inline (mismo criterio que FollowButton).
// - Anónima: el corazón + contador son un enlace a /login?next=<ruta actual>.
export function LikeButton({
  kind = "post",
  itemId,
  initialLiked,
  initialCount,
  path,
  isLoggedIn,
}: {
  kind?: "post" | "garment";
  itemId: string;
  initialLiked: boolean;
  initialCount: number;
  path: string;
  isLoggedIn: boolean;
}) {
  // Mismo patrón que SaveButton: un solo componente y la acción depende del tipo.
  const like = kind === "post" ? likePost : likeGarment;
  const unlike = kind === "post" ? unlikePost : unlikeGarment;
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(path)}`}
        aria-label={`${count} me gusta — inicia sesión para dar like`}
        className="glass inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-ink/70 hover:bg-white/70"
      >
        <Heart className="h-4 w-4" aria-hidden />
        <span className="tabular-nums">{count}</span>
      </Link>
    );
  }

  function toggle() {
    const next = !liked;
    setLiked(next); // optimistic
    setCount((c) => c + (next ? 1 : -1));
    setError(null);
    startTransition(async () => {
      const res = next ? await like(itemId, path) : await unlike(itemId, path);
      if (!res.ok) {
        setLiked(!next); // rollback
        setCount((c) => c + (next ? -1 : 1));
        setError(res.error);
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? "Quitar me gusta" : "Me gusta"}
        className={`glass inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm transition disabled:opacity-60 hover:bg-white/70 ${
          liked ? "text-coral" : "text-ink/70"
        }`}
      >
        <Heart
          className={`h-4 w-4 ${liked ? "fill-current" : ""}`}
          aria-hidden
        />
        <span className="tabular-nums">{count}</span>
      </button>
      {error && (
        <p role="alert" className="text-xs text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
