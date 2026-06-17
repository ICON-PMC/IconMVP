import Link from "next/link";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";
import { GoogleButton } from "@/components/google-button";
import { signIn } from "@/app/auth/actions";

export default async function LoginPage({
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
          <h1 className="text-3xl font-medium tracking-tight text-forest">Icon</h1>
          <p className="mt-1 mb-6 text-sm text-ink/70">
            Entra para guardar tus prendas favoritas.
          </p>

          {error && (
            <p className="mb-4 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
              {error}
            </p>
          )}

          <form action={signIn} className="flex flex-col gap-3">
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
              placeholder="Contraseña"
              required
              autoComplete="current-password"
            />
            <button
              className="mt-1 rounded-xl bg-forest px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest-deep"
              type="submit"
            >
              Iniciar sesión
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-ink/40">
            <span className="h-px flex-1 bg-ink/10" /> o
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <GoogleButton />

          <p className="mt-6 text-center text-sm text-ink/60">
            ¿No tienes cuenta?{" "}
            <Link
              href="/signup"
              className="font-medium text-coral hover:underline"
            >
              Regístrate
            </Link>
          </p>
        </GlassCard>
      </main>
    </>
  );
}
