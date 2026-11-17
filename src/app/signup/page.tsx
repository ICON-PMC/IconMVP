import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { AuthNotice, AuthShell, OrDivider } from "@/components/auth-shell";
import { FormField } from "@/components/form-field";
import { GoogleButton } from "@/components/google-button";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tipo?: string; stub?: string }>;
}) {
  const { error, tipo, stub: stubRaw } = await searchParams;
  // Spec 010: viene de "¿Es tu marca? Regístrala" en un look.
  const stub = stubRaw && /^[0-9a-f-]{36}$/i.test(stubRaw) ? stubRaw : null;
  const isBrand = tipo === "marca";
  const seg = "flex min-h-10 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors";

  return (
    <AuthShell
      title={isBrand ? "Registra tu marca" : "Crea tu cuenta"}
      subtitle={
        isBrand
          ? "Primero crea tu cuenta; en el siguiente paso armas el perfil de tu marca."
          : "Guarda outfits y prendas de marcas colombianas."
      }
    >
      <nav aria-label="Tipo de cuenta" className="mb-5 grid grid-cols-2 rounded-full bg-surface-sunken p-1">
        <Link href="/signup" aria-current={!isBrand ? "page" : undefined} className={cn(seg, !isBrand ? "bg-surface-inverse text-text-inverse" : "text-text")}>
          Soy usuario
        </Link>
        <Link href={stub ? `/signup?tipo=marca&stub=${stub}` : "/signup?tipo=marca"} aria-current={isBrand ? "page" : undefined} className={cn(seg, isBrand ? "bg-surface-inverse text-text-inverse" : "text-text")}>
          Soy una marca
        </Link>
      </nav>

      {error && <AuthNotice tone="error">{error}</AuthNotice>}

      <form action={signUp} className="flex flex-col gap-4">
        {isBrand && <input type="hidden" name="account_type" value="brand" />}
        {isBrand && stub && <input type="hidden" name="stub" value={stub} />}
        <FormField label={isBrand ? "Tu nombre" : "Nombre"} htmlFor="signup-name">
          <Input id="signup-name" type="text" name="display_name" autoComplete="name" />
        </FormField>
        <FormField label="Correo" htmlFor="signup-email">
          <Input id="signup-email" type="email" name="email" required autoComplete="email" placeholder="tu@correo.com" />
        </FormField>
        <FormField label="Contraseña" htmlFor="signup-password" hint="Mínimo 6 caracteres.">
          <Input id="signup-password" type="password" name="password" required minLength={6} autoComplete="new-password" aria-describedby="signup-password-hint" />
        </FormField>
        {/* Se deshabilita mientras corre: un doble toque mandaba dos signUp y el segundo
            mostraba "ya registrado" aunque la cuenta sí se creó. */}
        <SubmitButton pendingText="Creando cuenta…" size="lg" className="mt-1 w-full">
          Crear cuenta
        </SubmitButton>
      </form>

      {!isBrand && (
        <>
          <OrDivider />
          <GoogleButton />
        </>
      )}

      <p className="mt-6 text-center text-sm text-text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-action-text hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}
