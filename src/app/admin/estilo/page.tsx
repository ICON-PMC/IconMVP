import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Familjen_Grotesk } from "next/font/google";
import { BadgeCheckIcon, SearchXIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { PageHeader } from "@/components/page-header";
import { Price } from "@/components/price";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth";
import { displayFont } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { ButtonDemo, ChipDemo, FieldDemo, SheetDemo } from "./demos";

// Guía de estilo viva del sistema "tropical plano" (spec 007, US1). Solo equipo; sin indexar.
export const metadata: Metadata = { title: "Guía de estilo · Icon", robots: { index: false } };

// Candidatas de tipografía para comparar (solo se cargan en esta página).
const archivo = Archivo({ subsets: ["latin"], weight: "variable", display: "swap", variable: "--font-display-family" });
const familjen = Familjen_Grotesk({ subsets: ["latin"], weight: "variable", display: "swap", variable: "--font-display-family" });
const FONTS = {
  bricolage: { label: "Bricolage Grotesque", font: displayFont, note: "Grotesca con carácter; la más cercana a la referencia 1." },
  archivo: { label: "Archivo", font: archivo, note: "Más neutra y compacta." },
  familjen: { label: "Familjen Grotesk", font: familjen, note: "Más suave, cercana a la referencia 2." },
} as const;
type FontKey = keyof typeof FONTS;

// ── Contraste WCAG 2.1, calculado aquí para que la guía no mienta ─────────────
function lum(hex: string) {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const HEX = {
  cream: "#faf7ef",
  white: "#ffffff",
  ink: "#16271d",
  muted: "#667066",
  forest: "#1f5638",
  forestDeep: "#143b27",
  leaf: "#9fd08a",
  leafSoft: "#e6f1d9",
  coral: "#ee5a2d",
  coralDeep: "#c8401a",
  coralSoft: "#f6b59b",
  honey: "#f2c94c",
  sky: "#9cc3c9",
  blush: "#f3caba",
};

const SWATCHES: { token: string; use: string; bg: string; text: { name: string; hex: string }[] }[] = [
  { token: "surface", use: "Fondo de página", bg: HEX.cream, text: [{ name: "text", hex: HEX.ink }, { name: "text-muted", hex: HEX.muted }, { name: "action-text", hex: HEX.coralDeep }] },
  { token: "surface-raised", use: "Tarjetas, hojas, campos", bg: HEX.white, text: [{ name: "text", hex: HEX.ink }, { name: "text-muted", hex: HEX.muted }] },
  { token: "surface-sunken", use: "Chips de etiqueta, estados vacíos", bg: HEX.leafSoft, text: [{ name: "text", hex: HEX.ink }, { name: "forest", hex: HEX.forest }] },
  { token: "surface-inverse", use: "Tarjetas oscuras, barra inferior", bg: HEX.forestDeep, text: [{ name: "text-inverse", hex: HEX.cream }, { name: "leaf", hex: HEX.leaf }, { name: "honey", hex: HEX.honey }] },
  { token: "action", use: "Botón principal, chip activo, “+”", bg: HEX.coral, text: [{ name: "action-ink", hex: HEX.ink }] },
  { token: "danger", use: "Errores y acciones de peligro", bg: HEX.coralDeep, text: [{ name: "white", hex: HEX.white }] },
  { token: "accent-leaf", use: "Acento, verificado", bg: HEX.leaf, text: [{ name: "ink", hex: HEX.ink }] },
  { token: "accent-honey", use: "Acento, nuevo, aviso", bg: HEX.honey, text: [{ name: "ink", hex: HEX.ink }] },
  { token: "accent-sky", use: "Acento", bg: HEX.sky, text: [{ name: "ink", hex: HEX.ink }] },
  { token: "accent-blush", use: "Acento", bg: HEX.blush, text: [{ name: "ink", hex: HEX.ink }] },
];

const SECTIONS = [
  ["colores", "Colores"],
  ["tipografia", "Tipografía"],
  ["botones", "Botones"],
  ["chips", "Chips"],
  ["campos", "Campos"],
  ["tarjetas", "Tarjetas"],
  ["navegacion", "Pestañas"],
  ["hojas", "Hojas"],
  ["estados", "Estados"],
  ["tono", "Tono"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line py-10">
      <h2 className="mb-5 text-h2">{title}</h2>
      {children}
    </section>
  );
}

export default async function StyleGuidePage({ searchParams }: { searchParams: Promise<{ fuente?: string }> }) {
  await requireStaff();
  const { fuente } = await searchParams;
  const key: FontKey = fuente && fuente in FONTS ? (fuente as FontKey) : "bricolage";
  const chosen = FONTS[key];

  return (
    // La variable --font-display-family de la candidata elegida se aplica a toda la guía.
    <div
      className={cn(chosen.font.variable, "min-h-dvh bg-surface text-text")}
      // Las variables CSS se resuelven donde se declaran: hay que volver a declarar --font-display
      // aquí para que tome la candidata de este contenedor y no la de la raíz.
      style={{ "--font-display": "var(--font-display-family), var(--font-geist-sans), system-ui, sans-serif" } as React.CSSProperties}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <PageHeader
          title="Guía de estilo"
          subtitle="Sistema “tropical plano” (spec 007). Solo para el equipo."
          back={{ href: "/admin", label: "Panel" }}
        />
        <nav aria-label="Secciones" className="flex flex-wrap gap-2">
          {SECTIONS.map(([id, label]) => (
            <Chip key={id} href={`#${id}`}>
              {label}
            </Chip>
          ))}
        </nav>

        <Section id="colores" title="Colores">
          <p className="mb-5 max-w-2xl text-sm text-text-muted">
            La paleta de Icon con un nombre de uso por color. Los componentes usan el nombre de uso, no el
            color. Cada combinación muestra su contraste: 4,5 o más es AA para texto normal; 3 o más, para
            texto grande. El texto sobre coral es siempre tinta.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SWATCHES.map((s) => (
              <div key={s.token} className="surface overflow-hidden">
                <div className="flex h-24 flex-col justify-end gap-0.5 p-3" style={{ background: s.bg }}>
                  {s.text.map((t) => {
                    const c = contrast(s.bg, t.hex);
                    return (
                      <span key={t.name} className="text-sm font-semibold" style={{ color: t.hex }}>
                        {t.name} · {c.toFixed(1)}:1 {c >= 4.5 ? "AA" : c >= 3 ? "AA grande" : "✗"}
                      </span>
                    );
                  })}
                </div>
                <div className="p-3">
                  <p className="font-mono text-xs">{s.token}</p>
                  <p className="text-sm text-text-muted">{s.use}</p>
                  <p className="font-mono text-xs text-text-muted">{s.bg}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="tipografia" title="Tipografía">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-label">Candidata:</span>
            {(Object.keys(FONTS) as FontKey[]).map((k) => (
              <Chip key={k} href={`/admin/estilo?fuente=${k}#tipografia`} selected={k === key}>
                {FONTS[k].label}
              </Chip>
            ))}
          </div>
          <p className="mb-6 text-sm text-text-muted">
            {chosen.label}: {chosen.note} Los títulos usan esta familia; el texto sigue en Geist. El
            wordmark <span className="wordmark text-2xl">ICON</span> sigue en serif.
          </p>
          <div className="flex flex-col gap-5">
            <p className="text-display">Moda colombiana, hecha con intención</p>
            <p className="text-h1">Explorar · ¿Qué te pones hoy?</p>
            <p className="text-h2">Camisa de lino — Barranquilla</p>
            <p className="text-h3">Ñapa, añil, cañaveral y montaña</p>
            <p className="max-w-2xl text-base">
              Cuerpo (16/24, Geist). Descubre marcas independientes de Barranquilla, Medellín y Bogotá:
              filtra por ocasión, ciudad, precio y estilo, y ve directo a la tienda de quien la hace.
            </p>
            <p className="text-sm text-text-muted">Cuerpo pequeño (14/20). Texto secundario y ayudas.</p>
            <p className="text-label">Etiqueta (13/16, seminegrita)</p>
          </div>
        </Section>

        <Section id="botones" title="Botones">
          <ButtonDemo />
          <p className="mt-4 text-sm text-text-muted">
            Recorre con Tab: cada botón muestra un anillo de foco. Alto mínimo de 44 px.
          </p>
        </Section>

        <Section id="chips" title="Chips">
          <ChipDemo />
        </Section>

        <Section id="campos" title="Campos">
          <FieldDemo />
          <p className="mt-3 text-sm text-text-muted">Escribe 1 o 2 letras en el primer campo para ver el error.</p>
        </Section>

        <Section id="tarjetas" title="Tarjetas, insignias y avatares">
          <p className="mb-4 text-sm text-text-muted">
            Las tarjetas de prenda y de look llegan en la historia 3 (feed). Mientras, sus piezas:
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="surface p-4">
              <p className="text-label">Prenda</p>
              <div className="mt-2 aspect-[4/5] rounded-[var(--radius-photo)] bg-surface-sunken" />
              <p className="mt-2 truncate text-sm font-semibold">Camisa de lino oversize color arena</p>
              <p className="text-[13px] text-text-muted">BLRS Lifestyle</p>
              <Price min={150000} className="text-sm" />
            </div>
            <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-surface-inverse">
              <div className="aspect-[4/5]" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-3 pt-12 text-text-inverse">
                <div className="flex items-center gap-2">
                  <Avatar image={null} name="Laura Moda" seed="laura" size={24} />
                  <span className="text-[13px] font-semibold">Laura Moda</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <Chip variant="on-dark">Brunch</Chip>
                  <Chip variant="on-dark">Casual</Chip>
                </div>
              </div>
              <p className="absolute top-3 left-3 text-label text-text-inverse">Look</p>
            </div>
            <div className="surface-inverse flex flex-col gap-2 p-4">
              <p className="text-label text-text-inverse/80">Marca</p>
              <div className="flex items-center gap-3">
                <Avatar image={null} name="Joer" seed="joer" size={48} />
                <div>
                  <p className="text-h3">Joer</p>
                  <p className="text-[13px] text-text-inverse/80">Medellín, Antioquia</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip variant="on-dark">Urbano</Chip>
                <Chip variant="on-dark">Streetwear</Chip>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Badge variant="verified">
              <BadgeCheckIcon data-icon="inline-start" /> Verificada
            </Badge>
            <Badge variant="new">Nuevo</Badge>
            <Badge variant="neutral">Sin verificar</Badge>
            <Badge variant="warning">Pendiente</Badge>
            {([24, 32, 48, 96] as const).map((s) => (
              <Avatar key={s} image={null} name="Sofía Ríos" seed={`s${s}`} size={s} />
            ))}
          </div>
        </Section>

        <Section id="navegacion" title="Pestañas">
          <div className="flex flex-col gap-6">
            <LinkTabs
              label="Ejemplo de pestañas en píldora"
              active="prendas"
              tabs={[
                { id: "todo", label: "Todo", href: "/admin/estilo#navegacion", badge: 48 },
                { id: "prendas", label: "Prendas", href: "/admin/estilo#navegacion", badge: 32 },
                { id: "outfits", label: "Outfits", href: "/admin/estilo#navegacion", badge: 12 },
                { id: "marcas", label: "Marcas", href: "/admin/estilo#navegacion", badge: 4 },
              ]}
            />
            <LinkTabs
              label="Ejemplo de pestañas subrayadas"
              variant="underline"
              active="looks"
              tabs={[
                { id: "prendas", label: "Prendas", href: "/admin/estilo#navegacion" },
                { id: "looks", label: "Looks", href: "/admin/estilo#navegacion" },
                { id: "resenas", label: "Reseñas", href: "/admin/estilo#navegacion" },
              ]}
            />
            <p className="text-sm text-text-muted">
              La barra de navegación inferior llega en la historia 2.
            </p>
          </div>
        </Section>

        <Section id="hojas" title="Hojas">
          <SheetDemo />
          <p className="mt-3 text-sm text-text-muted">En celular sale abajo con asa; en escritorio, a la derecha.</p>
        </Section>

        <Section id="estados" title="Estados">
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState
              icon={SearchXIcon}
              title="No encontramos nada"
              description="Prueba con otro término o quita algún filtro."
              action={{ label: "Quitar filtros", href: "/admin/estilo#estados" }}
            />
            <div className="surface flex flex-col gap-3 p-4" aria-hidden>
              <Skeleton className="aspect-[4/5] w-full rounded-[var(--radius-photo)]" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </Section>

        <Section id="tono" title="Tono">
          <ul className="max-w-2xl list-disc space-y-2 pl-5 text-sm">
            <li>Tuteo, frases cortas, sin tecnicismos: “Guarda la prenda”, no “Agregar ítem a favoritos”.</li>
            <li>
              Lenguaje inclusivo: “usuario”, “quien publica”, “te damos la bienvenida”. Sin asumir género.
            </li>
            <li>Acciones con verbo: “Ir a la tienda”, “Guardar”, “Seguir”, “Publicar”.</li>
            <li>Errores que dicen qué pasó y qué hacer: “Elige al menos un estilo”.</li>
            <li>Estados vacíos con una salida: “Todavía no guardas nada. Explora el feed”.</li>
          </ul>
          <p className="mt-4 text-sm text-text-muted">
            Guía completa: <span className="font-mono">specs/007-rediseno-ui/guia-de-tono.md</span> (llega en la
            historia 6). <Link href="/admin" className="text-action-text hover:underline">Volver al panel</Link>.
          </p>
        </Section>
      </div>
    </div>
  );
}
