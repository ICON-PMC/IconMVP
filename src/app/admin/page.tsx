import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { Aurora } from "@/components/aurora";
import { GlassCard } from "@/components/glass-card";

// Panel del equipo. Solo staff (curator/admin). Aquí vivirá el cargador de contenido.
export default async function AdminPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login?next=/admin");
  if (!isStaff(session.profile)) redirect("/");

  return (
    <>
      <Aurora />
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-6 p-6">
        <GlassCard className="p-8">
          <span className="inline-block rounded-full bg-forest/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-forest">
            {session.profile?.role}
          </span>
          <h1 className="mt-3 text-3xl font-medium tracking-tight text-forest">
            Panel del equipo
          </h1>
          <p className="mt-2 text-sm text-ink/70">
            Hola {session.profile?.display_name ?? session.email}. Aquí vivirá el
            cargador de contenido: marcas, prendas y posts.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-coral hover:underline"
          >
            ← Volver al inicio
          </Link>
        </GlassCard>
      </main>
    </>
  );
}
