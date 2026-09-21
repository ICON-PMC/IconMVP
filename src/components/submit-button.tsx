"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Botón de envío que se deshabilita y cambia de texto mientras la server action corre. */
export function SubmitButton({
  children,
  pendingText = "Guardando…",
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
