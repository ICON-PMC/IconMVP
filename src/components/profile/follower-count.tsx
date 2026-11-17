"use client";

import { useEffect, useState } from "react";
import { FOLLOW_EVENT, type FollowEventDetail } from "@/components/profile/user-follow-button";

/** Número de seguidores (con su palabra) que se actualiza al momento cuando se toca "Seguir" en la misma página. */
export function FollowerCount({ userId, initial }: { userId: string; initial: number }) {
  const [n, setN] = useState(initial);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<FollowEventDetail>).detail;
      if (d?.userId === userId) setN((x) => Math.max(0, x + d.delta));
    };
    window.addEventListener(FOLLOW_EVENT, on);
    return () => window.removeEventListener(FOLLOW_EVENT, on);
  }, [userId]);
  return (
    <>
      <strong className="font-semibold text-text">{n}</strong> {n === 1 ? "seguidor" : "seguidores"}
    </>
  );
}
