"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { saveBrandCover, type BrandFormState } from "./actions";

export function CoverForm({ currentUrl }: { currentUrl: string | null }) {
  const [state, action, pending] = useActionState<BrandFormState, FormData>(
    saveBrandCover,
    {},
  );
  // URL de blob solo para la vista previa local; a R2 se sube el archivo, no esta URL.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const shown = preview ?? currentUrl;

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message && (
        <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">{state.message}</p>
      )}

      <label
        htmlFor="image"
        className="glass-input relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-2xl text-center text-sm text-ink/60"
      >
        {shown ? (
          <Image src={shown} alt="Vista previa de la portada" fill unoptimized className="object-cover" />
        ) : (
          <span className="px-6">Toca para elegir una foto de portada</span>
        )}
        <input
          id="image"
          name="image"
          type="file"
          accept="image/*"
          className="sr-only"
          aria-describedby="cover-err"
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
      </label>
      {state.errors?.cover && (
        <p id="cover-err" role="alert" className="-mt-2 text-xs text-coral">
          {state.errors.cover}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button
          type="submit"
          disabled={pending}
          size="lg" className="flex-1 rounded-xl bg-forest text-base text-white hover:bg-forest-deep md:text-sm"
        >
          {pending ? "Subiendo…" : "Continuar"}
        </Button>
        <Link href="/onboarding/marca?paso=1" className="inline-flex min-h-11 items-center px-2 text-sm text-ink/60 hover:underline">
          Atrás
        </Link>
      </div>
    </form>
  );
}
