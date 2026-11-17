import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

/** Encabezado de página (spec 007): volver opcional, título en la escala de exhibición y acciones. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-2">
      {back && (
        <Link
          href={back.href}
          className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-action-text hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1 text-text">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
