import type { ReactNode } from "react";
import { CircleAlertIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Campo del sistema (spec 007): etiqueta arriba, control, y ayuda o error abajo. `htmlFor` debe
 * coincidir con el `id` del control; con `error`, el control debería llevar
 * `aria-invalid` y `aria-describedby={`${htmlFor}-error`}`.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-label text-text">
        {label}
      </Label>
      {children}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
          className="flex items-center gap-1.5 text-[13px] text-danger"
        >
          <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-[13px] text-text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Nombre del sistema nuevo; mismo componente. */
export const Field = FormField;
