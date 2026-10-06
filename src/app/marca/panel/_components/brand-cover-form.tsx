"use client";

import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { imageUrl } from "@/lib/images";
import { updateBrandCover } from "../actions";

/** Portada de la marca (Panel → Perfil): vista previa local y subida al guardar. */
export function BrandCoverForm({ currentKey }: { currentKey: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  // URL de blob solo para la vista previa local; a R2 se sube el archivo.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const shown = preview ?? imageUrl(currentKey);

  return (
    <form action={updateBrandCover} className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/60">Portada</p>
      <label
        htmlFor="cover-image"
        className="glass-input relative flex aspect-[4/3] max-h-64 cursor-pointer items-center justify-center overflow-hidden rounded-2xl text-center text-sm text-ink/60"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Portada de la marca" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="px-6">Toca para elegir una foto de portada</span>
        )}
        <input
          id="cover-image"
          name="image"
          type="file"
          accept="image/*"
          required
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
      </label>
      {preview && (
        <SubmitButton variant="outline" pendingText="Subiendo…" className="self-start rounded-full">
          Guardar portada
        </SubmitButton>
      )}
    </form>
  );
}
