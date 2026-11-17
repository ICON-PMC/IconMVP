"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CityCombobox } from "@/components/city-combobox";
import { FormField } from "@/components/form-field";
import { HandleField } from "@/components/profile/handle-field";
import { StickyActionBar } from "@/components/sticky-action-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PROFILE_LIMITS } from "@/lib/profile-rules";
import { updateProfile, type ProfileFieldErrors } from "../actions";

type CityOption = Parameters<typeof CityCombobox>[0]["options"][number];

export function EditProfileForm({
  cities,
  initial,
}: {
  cities: CityOption[];
  initial: { handle: string; displayName: string; bio: string; city: string | null; linkUrl: string };
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData) {
    setErrors({});
    startTransition(async () => {
      const res = await updateProfile(fd);
      if (!res.ok) {
        setErrors(res.fieldErrors);
        if (res.fieldErrors.form) toast.error(res.fieldErrors.form);
        return;
      }
      toast.success("Perfil guardado.");
      router.push(`/u/${res.handle}`);
      router.refresh();
    });
  }

  const err = (k: keyof ProfileFieldErrors) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `${k}-error` } : {});

  return (
    <form action={submit} className="surface mt-4 flex flex-col gap-5 p-5 pb-24 md:p-6 md:pb-6">
      <HandleField defaultValue={initial.handle} error={errors.handle} />
      <FormField label="Nombre visible" htmlFor="display_name" error={errors.display_name} hint={`${displayName.length}/${PROFILE_LIMITS.displayName}`}>
        <Input
          id="display_name"
          name="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={PROFILE_LIMITS.displayName}
          placeholder="Cómo quieres que te vean"
          autoComplete="name"
          {...err("display_name")}
        />
      </FormField>
      <FormField label="Bio" htmlFor="bio" error={errors.bio} hint={`${bio.length}/${PROFILE_LIMITS.bio}`}>
        <Textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={PROFILE_LIMITS.bio}
          rows={3}
          placeholder="Cuéntale a la gente tu estilo"
          {...err("bio")}
        />
      </FormField>
      <FormField label="Ciudad" htmlFor="city" error={errors.city}>
        <CityCombobox id="city" name="city" options={cities} defaultValue={initial.city} invalid={!!errors.city} />
      </FormField>
      <FormField label="Enlace" htmlFor="link_url" error={errors.link_url} hint="Tu Instagram, tu blog o tu tienda. Debe empezar por https://">
        <Input
          id="link_url"
          name="link_url"
          type="url"
          inputMode="url"
          defaultValue={initial.linkUrl}
          placeholder="https://"
          {...err("link_url")}
        />
      </FormField>
      <StickyActionBar stackAboveNav>
        <Button type="submit" size="lg" className="w-full md:w-fit" loading={pending}>
          Guardar
        </Button>
      </StickyActionBar>
    </form>
  );
}
