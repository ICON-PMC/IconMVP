import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Etiqueta + control + ayuda/error. `htmlFor` debe coincidir con el `id` del control. */
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
      <Label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wide text-ink/60">
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-coral">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink/50">{hint}</p>
      )}
    </div>
  );
}
