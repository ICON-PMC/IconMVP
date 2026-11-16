"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookmarkIcon, HomeIcon, PlusIcon, SearchIcon, UserIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CameraButton } from "@/components/visual/camera-button";
import { CENTRAL_ACTION, activeNavKey, navItems, type NavContext, type NavKey } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Con el teclado abierto el viewport visible se encoge: la barra se oculta para no tapar el campo.
function subscribeViewport(cb: () => void) {
  const vv = window.visualViewport;
  vv?.addEventListener("resize", cb);
  return () => vv?.removeEventListener("resize", cb);
}
function useKeyboardOpen() {
  return useSyncExternalStore(
    subscribeViewport,
    () => (window.visualViewport ? window.visualViewport.height < window.innerHeight * 0.75 : false),
    () => false,
  );
}

const ICONS: Partial<Record<NavKey, typeof HomeIcon>> = {
  home: HomeIcon,
  search: SearchIcon,
  saved: BookmarkIcon,
};

/**
 * Barra inferior fija en móvil (spec 007, US2): Inicio, Buscar, acción central, Guardados y Cuenta.
 * Píldora oscura flotante con área segura; solo bajo 768 px.
 */
export function BottomNav({ ctx }: { ctx: NavContext }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const active = activeNavKey(pathname, search);
  const keyboardOpen = useKeyboardOpen();
  const items = navItems(ctx);

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        "fixed inset-x-3 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[480px] md:hidden",
        keyboardOpen && "hidden",
      )}
    >
      <ul className="bar-blur-inverse flex h-16 items-center justify-around rounded-full px-2 text-text-inverse shadow-[var(--shadow-float)]">
        {items.map((item) => {
          const isActive = active === item.key;
          if (item.key === "central") {
            const central = "flex size-14 -translate-y-3 items-center justify-center rounded-full bg-action text-action-ink shadow-[var(--shadow-float)] outline-none focus-visible:ring-2 focus-visible:ring-text-inverse";
            return (
              <li key={item.key}>
                {CENTRAL_ACTION === "photo-search" ? (
                  <CameraButton isLoggedIn={ctx.isLoggedIn} className={central} />
                ) : (
                  <Link href={item.href} aria-label={item.label} className={central}>
                    <PlusIcon className="size-6" />
                  </Link>
                )}
              </li>
            );
          }
          const Icon = ICONS[item.key];
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-text-inverse",
                  isActive ? "text-leaf" : "text-text-inverse/75 hover:text-text-inverse",
                )}
              >
                {item.key === "account" ? (
                  ctx.isLoggedIn ? (
                    <Avatar image={ctx.avatar} name={ctx.displayName} seed={ctx.seed} size={24} className={cn(isActive && "ring-2 ring-leaf")} />
                  ) : (
                    <UserIcon className="size-5" aria-hidden />
                  )
                ) : (
                  Icon && <Icon className="size-5" aria-hidden />
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
