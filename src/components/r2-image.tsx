"use client";

import { useState } from "react";
import { imageSrcSet, imageUrl } from "@/lib/images";

/** Tamaños acordados (spec 006, contracts §2). */
export const SIZES = {
  // Ancho real de la tarjeta: media pantalla (o un tercio) menos márgenes y separación. Con esto un
  // celular de densidad media pide la versión de 320 px y uno de alta densidad la de 640.
  // Board de hasta 4 columnas en un contenedor de 1280 px.
  card: "(min-width: 1280px) 300px, (min-width: 1024px) calc(25vw - 24px), (min-width: 768px) calc(33vw - 24px), calc(50vw - 24px)",
  detail: "(min-width: 768px) 50vw, 100vw",
} as const;

/**
 * Foto de R2 en el tamaño justo (spec 006): `srcset` con las variantes de 320 y 640 px y la principal
 * de 1280 px. Si una variante no existe (aún no generada), la primera vez que falla quita el `srcset`
 * y carga la principal; nunca deja un hueco. El espacio lo reserva el contenedor con `aspect-ratio`.
 */
export function R2Image({
  image,
  alt,
  sizes,
  priority = false,
  className,
}: {
  image: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = imageUrl(image);
  const srcSet = imageSrcSet(image);
  const [fallback, setFallback] = useState(false);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- R2 sirve las variantes; no pasa por next/image
    <img
      src={src}
      srcSet={fallback ? undefined : srcSet}
      sizes={fallback || !srcSet ? undefined : sizes}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding={priority ? undefined : "async"}
      onError={() => {
        if (srcSet && !fallback) setFallback(true);
      }}
      className={className}
    />
  );
}
