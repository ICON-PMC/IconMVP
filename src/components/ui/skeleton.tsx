import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-[var(--radius-field)] bg-surface-sunken motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
