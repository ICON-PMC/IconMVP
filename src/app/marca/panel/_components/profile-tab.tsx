import { GlassCard } from "@/components/glass-card";
import { FormField } from "@/components/form-field";
import { StickyActionBar } from "@/components/sticky-action-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MyBrand } from "@/lib/auth";
import { updateBrandProfile } from "../actions";

const FORM_ID = "brand-profile-form";

export function ProfileTab({ brand }: { brand: MyBrand }) {
  return (
    <>
      <GlassCard className="p-5">
        <form id={FORM_ID} action={updateBrandProfile} className="flex flex-col gap-4">
          <FormField label="Nombre" htmlFor="name">
            <Input id="name" name="name" defaultValue={brand.name} required autoComplete="off" />
          </FormField>
          <FormField label="Bio" htmlFor="bio" hint="Una frase que cuente qué hace tu marca.">
            <Input id="bio" name="bio" defaultValue={brand.bio ?? ""} />
          </FormField>
          <FormField label="Tienda online" htmlFor="store_url">
            <Input
              id="store_url"
              name="store_url"
              type="url"
              inputMode="url"
              defaultValue={brand.store_url ?? ""}
              placeholder="https://"
            />
          </FormField>
          <FormField label="Instagram" htmlFor="instagram">
            <Input
              id="instagram"
              name="instagram"
              defaultValue={brand.instagram ?? ""}
              placeholder="marca.co"
              autoCapitalize="none"
            />
          </FormField>
        </form>
      </GlassCard>
      <StickyActionBar>
        <Button type="submit" form={FORM_ID} size="lg" className="w-full rounded-full sm:w-auto sm:px-8">
          Guardar cambios
        </Button>
      </StickyActionBar>
    </>
  );
}
