import Link from "next/link";

/**
 * Marco de las pantallas de cuenta (spec 007, US5): sin barra inferior, wordmark arriba y una tarjeta
 * centrada. Fondo crema plano (sin Aurora).
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-surface px-4 py-8 md:justify-center">
      <Link href="/" className="wordmark mb-8 text-[40px] leading-none text-text" aria-label="Icon, ir al inicio">
        ICON
      </Link>
      <div className="surface w-full max-w-sm p-6 md:p-8">
        <h1 className="text-h2 text-text">{title}</h1>
        {subtitle && <p className="mt-1.5 mb-6 text-sm text-text-muted">{subtitle}</p>}
        {children}
      </div>
    </main>
  );
}

/** Aviso dentro de una tarjeta de cuenta: informativo o de error. */
export function AuthNotice({ tone, children }: { tone: "info" | "error"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "mb-4 rounded-[var(--radius-field)] bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
          : "mb-4 rounded-[var(--radius-field)] bg-surface-sunken px-3.5 py-2.5 text-sm text-text"
      }
    >
      {children}
    </p>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-text-muted" aria-hidden>
      <span className="h-px flex-1 bg-line" /> o <span className="h-px flex-1 bg-line" />
    </div>
  );
}
