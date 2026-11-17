import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field flex field-sizing-content min-h-24 w-full px-3.5 py-3 text-base transition-colors outline-none placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-danger md:text-[15px]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
