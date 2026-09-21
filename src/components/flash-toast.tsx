"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/** Convierte `?ok=` / `?error=` (que dejan las server actions al redirigir) en un toast y limpia la URL. */
export function FlashToast({ messages = {} }: { messages?: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ok = params.get("ok");
  const error = params.get("error");

  useEffect(() => {
    if (!ok && !error) return;
    if (error) toast.error(error);
    else if (ok) toast.success(messages[ok] ?? "Listo.");
    const next = new URLSearchParams(params.toString());
    next.delete("ok");
    next.delete("error");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [ok, error, params, pathname, router, messages]);

  return null;
}
