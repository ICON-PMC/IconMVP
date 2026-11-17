import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Vista 404 compartida (spec 007, US5): la usan los not-found.tsx de cada ruta con su propio texto.
// Dentro del grupo (app) la navegación la pone el layout; la raíz pasa `withBrand` para mostrar el
// wordmark y una salida, porque ahí no hay barra.
export function NotFoundView({
  title,
  message,
  withBrand = false,
}: {
  title: string;
  message: string;
  withBrand?: boolean;
}) {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center bg-surface px-4 py-12 text-center">
      {withBrand && (
        <Link href="/" className="wordmark mb-10 text-[40px] leading-none text-text" aria-label="Icon, ir al inicio">
          ICON
        </Link>
      )}
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-surface-sunken text-text">
        <CompassIcon className="size-6" aria-hidden />
      </span>
      <p className="text-label text-text-muted">Error 404</p>
      <h1 className="mt-2 max-w-md text-h2 text-text">{title}</h1>
      <p className="mt-3 max-w-md text-[15px] text-text-muted">{message}</p>
      <Button size="lg" className="mt-6" render={<Link href="/feed" />} nativeButton={false}>
        Volver al feed
      </Button>
    </main>
  );
}
