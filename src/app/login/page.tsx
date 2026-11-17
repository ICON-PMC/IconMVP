import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { AuthNotice, AuthShell, OrDivider } from "@/components/auth-shell";
import { FormField } from "@/components/form-field";
import { GoogleButton } from "@/components/google-button";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; aviso?: string; next?: string }>;
}) {
  const { error, aviso, next } = await searchParams;

  return (
    <AuthShell title="Inicia sesión" subtitle="Guarda prendas y looks de marcas colombianas.">
      {aviso && !error && <AuthNotice tone="info">{aviso}</AuthNotice>}
      {error && <AuthNotice tone="error">{error}</AuthNotice>}

      <form action={signIn} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <FormField label="Correo" htmlFor="login-email">
          <Input id="login-email" type="email" name="email" required autoComplete="email" placeholder="tu@correo.com" />
        </FormField>
        <FormField label="Contraseña" htmlFor="login-password">
          <Input id="login-password" type="password" name="password" required autoComplete="current-password" />
        </FormField>
        <SubmitButton pendingText="Entrando…" size="lg" className="mt-1 w-full">
          Iniciar sesión
        </SubmitButton>
      </form>

      <OrDivider />
      <GoogleButton />

      <p className="mt-6 text-center text-sm text-text-muted">
        ¿No tienes cuenta?{" "}
        <Link href="/signup" className="font-semibold text-action-text hover:underline">
          Regístrate
        </Link>
      </p>
    </AuthShell>
  );
}
