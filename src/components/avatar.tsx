import { R2Image } from "@/components/r2-image";
import { cn } from "@/lib/utils";

const ACCENTS = ["bg-leaf", "bg-honey", "bg-sky", "bg-blush"];

function initials(name: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Avatar circular (spec 007): foto, o iniciales sobre un color de acento estable por `seed`. */
export function Avatar({
  image,
  name,
  seed,
  size = 32,
  className,
  priority = false,
}: {
  image: string | null | undefined;
  name: string | null;
  seed: string;
  size?: 24 | 32 | 48 | 96;
  className?: string;
  /** Avatar visible al cargar (cabecera de perfil o marca): se pide de inmediato. */
  priority?: boolean;
}) {
  const box = cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", className);
  const style = { width: size, height: size };
  if (image)
    return (
      <span className={box} style={style}>
        <R2Image image={image} alt="" sizes={`${size}px`} priority={priority} className="size-full object-cover" />
      </span>
    );
  return (
    <span
      className={cn(box, ACCENTS[hash(seed) % ACCENTS.length], "font-semibold text-ink")}
      style={{ ...style, fontSize: Math.round(size * 0.38) }}
      aria-hidden={name ? undefined : true}
      title={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}
