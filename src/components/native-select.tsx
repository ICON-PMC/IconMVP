import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** `<select>` nativo con estilo glass: en móvil abre el selector del sistema (mejor UX en listas cortas). */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "glass-input h-11 w-full rounded-lg px-2.5 text-base text-ink md:h-8 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}
