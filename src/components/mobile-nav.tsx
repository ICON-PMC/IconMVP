"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/auth/actions";

/** Menú del header en móvil (< md): agrupa los enlaces que no caben en línea. */
export function MobileNav({
  links,
  label,
}: {
  links: { href: string; label: string }[];
  /** Nombre de la cuenta, mostrado como contexto encima de "Salir". */
  label?: string | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Abrir menú" className="-mr-2 rounded-full" />
        }
      >
        <MenuIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {links.map((l) => (
          <DropdownMenuItem key={l.href} render={<Link href={l.href} />} className="min-h-11 text-base">
            {l.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {label && <p className="truncate px-2 py-1.5 text-xs text-ink/60">{label}</p>}
        <DropdownMenuItem onClick={() => signOut()} className="min-h-11 text-base text-coral">
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
