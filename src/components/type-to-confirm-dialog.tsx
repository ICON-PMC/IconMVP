"use client";

import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const norm = (s: string) => s.trim().toLocaleLowerCase("es");

/**
 * Confirmación para acciones irreversibles grandes (cerrar una marca, borrar una cuenta): el
 * botón solo se habilita al escribir `phrase` (sin importar mayúsculas ni espacios de los bordes).
 * `onConfirm` recibe lo escrito para que el servidor lo vuelva a validar.
 */
export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  phrase,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  phrase: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: (typed: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = norm(typed) === norm(phrase);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex flex-col gap-1.5 text-sm text-ink/70">
          <span>
            Escribe <strong className="font-medium text-ink">{phrase}</strong> para confirmar
          </span>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            aria-label={`Escribe ${phrase} para confirmar`}
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={!matches || pending}
            onClick={() => onConfirm(typed)}
          >
            {pending ? "Un momento…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
