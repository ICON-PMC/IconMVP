import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"

// Botón del sistema "tropical plano" (spec 007, data-model §2). Píldora; el principal es coral con
// texto tinta (nunca blanco sobre coral: no cumple contraste). Los nombres viejos de variante
// (default, outline, destructive) se mantienen como alias para no romper usos existentes.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent text-[15px] font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none select-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-danger motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-action text-action-ink hover:bg-[color-mix(in_srgb,var(--color-action),var(--color-ink)_8%)]",
        secondary: "border-[1.5px] border-line-strong bg-transparent text-text hover:bg-surface-sunken aria-expanded:bg-surface-sunken",
        inverse: "bg-surface-inverse text-text-inverse hover:bg-[color-mix(in_srgb,var(--color-surface-inverse),white_8%)]",
        ghost: "text-text hover:bg-surface-sunken aria-expanded:bg-surface-sunken",
        danger: "bg-danger text-white hover:bg-[color-mix(in_srgb,var(--color-danger),black_10%)]",
        link: "rounded-none px-0 text-action-text underline-offset-4 hover:underline",
        // Alias de compatibilidad (código anterior a la 007).
        default: "bg-action text-action-ink hover:bg-[color-mix(in_srgb,var(--color-action),var(--color-ink)_8%)]",
        outline: "border-[1.5px] border-line-strong bg-transparent text-text hover:bg-surface-sunken aria-expanded:bg-surface-sunken",
        destructive: "bg-danger text-white hover:bg-[color-mix(in_srgb,var(--color-danger),black_10%)]",
      },
      size: {
        md: "h-11 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        lg: "h-13 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        sm: "h-9 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-11",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-3.5",
        // Alias de compatibilidad.
        default: "h-11 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-7 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-13",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Deshabilita el botón y muestra un indicador de carga (spec 007). */
    loading?: boolean
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
