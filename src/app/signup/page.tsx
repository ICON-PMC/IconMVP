import Link from "next/link";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { GoogleButton } from "@/components/google-button";
import { signUp } from "@/app/auth/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <Aurora />
      <main className="flex min-h-dvh items-center justify-center p-6">
        <GlassCard className="w-full max-w-sm p-8">
          <h1 className="text-3xl font-medium tracking-tight text-forest">
            Crea tu cuenta
          </h1>
          <p className="mt-1 mb-6 text-sm text-ink/70">
            Guarda outfits y prendas de marcas colombianas.
          </p>

          {error && (
            <p className="mb-4 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
              {error}
            </p>
          )}

          <form action={signUp} className="flex flex-col gap-3">
            <input
              className="glass-input rounded-xl px-4 py-2.5 text-sm"
              type="text"
              name="display_name"
              placeholder="Nombre"
              autoComplete="name"
            />
            <input
              className="glass-input rounded-xl px-4 py-2.5 text-sm"
              type="email"
              name="email"
              placeholder="Email"
              required
              autoComplete="email"
            />
            <input
              className="glass-input rounded-xl px-4 py-2.5 text-sm"
              type="password"
              name="password"
              placeholder="Contraseña (mín. 6)"
              required
              minLength={6}
              autoComplete="new-password"
            />
            <button
              className="mt-1 rounded-xl bg-forest px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest-deep"
              type="submit"
            >
              Crear cuenta
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-ink/40">
            <span className="h-px flex-1 bg-ink/10" /> o
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <GoogleButton />

          <p className="mt-6 text-center text-sm text-ink/60">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="font-medium text-coral hover:underline"
            >
              Inicia sesión
            </Link>
          </p>
        </GlassCard>
      </main>
    </>
  );
}
