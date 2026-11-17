import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { userLooksEnabled } from "@/lib/features";
import { getMyDrafts } from "@/lib/looks";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FlashToast } from "@/components/flash-toast";
import { R2Image } from "@/components/r2-image";
import { PhotoUploader } from "@/components/looks/photo-uploader";

export const metadata = { title: "Nuevo look · Icon" };

const FLASH = { borrado: "Borraste el look." };

// Crear un look (spec 008, US1): la primera foto crea el borrador y abre el editor.
export default async function CreateLookPage() {
  if (!userLooksEnabled()) notFound();
  const session = await getCurrentUser();
  if (!session?.profile) redirect("/login?next=/crear");
  if (session.profile.role === "brand") redirect("/marca/panel?tab=looks");

  const supabase = await createClient();
  const [drafts, { data: quota }] = await Promise.all([
    getMyDrafts(),
    supabase.rpc("check_user_storage_quota", { p_bytes: 0 }),
  ]);
  const q = quota as { used_bytes: number; limit_bytes: number } | null;
  const mb = (b: number) => (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0);
  const blocked = Boolean(session.profile.posting_blocked_at);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5 md:px-6">
      <Suspense>
        <FlashToast messages={FLASH} />
      </Suspense>
      <PageHeader title="Nuevo look" subtitle="Muestra cómo usas la moda local. Etiqueta las prendas y las marcas." />
      {blocked ? (
        <EmptyState
          title="Tu cuenta no puede publicar por ahora"
          description="Escríbenos si crees que es un error."
          action={{ label: "Volver al feed", href: "/feed" }}
        />
      ) : (
        <PhotoUploader postId={null} images={[]} />
      )}
      {q && (
        <p className="mt-4 text-center text-[13px] text-text-muted">
          Usas {mb(q.used_bytes)} de {mb(q.limit_bytes)} MB de fotos.
        </p>
      )}

      <section className="mt-10" aria-labelledby="borradores">
        <h2 id="borradores" className="text-h3 mb-3 text-text">
          Tus borradores
        </h2>
        {drafts.length ? (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={`/crear/${d.id}`} className="group block">
                  <div className="aspect-[4/5] overflow-hidden rounded-[var(--radius-photo)] bg-surface-sunken">
                    <R2Image image={d.image} alt="" sizes="(min-width: 640px) 170px, 30vw" className="size-full object-cover transition-transform group-hover:scale-[1.02]" />
                  </div>
                  <p className="mt-1 truncate text-[13px] text-text-muted">{d.caption || "Sin texto"}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={ImageIcon} title="No tienes borradores" description="Los looks que empieces y no publiques quedan aquí por 30 días." />
        )}
      </section>
    </main>
  );
}
