import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** `<select>` nativo con el estilo de campo del sistema (spec 007): en móvil abre el selector del sistema (mejor UX en listas cortas). */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "field h-12 w-full px-3 text-base text-text md:text-[15px]",
        className,
      )}
      {...props}
    />
  );
}
