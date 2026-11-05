import type { LandingPhoto } from "@/lib/landing";
import { formatCop } from "@/lib/landing";
import { CurvedArrow } from "./illustrations";
import { CheckList, CtaLink, DisplayTitle, Photo, SoonBadge } from "./ui";
import { AssistedRequest } from "./assisted-request";

// ── ¿Cómo subo? ──────────────────────────────────────────────────────────────
export function HowToUpload({ instagramLive }: { instagramLive: boolean }) {
  const card = "relative flex min-w-0 flex-col gap-4 rounded-[26px] border-[1.5px] border-ink p-5 sm:p-8";
  const sub = "text-xs font-semibold tracking-[0.12em] text-ink/60 uppercase";
  return (
    <section id="como" aria-labelledby="como-title" className="scroll-mt-6 py-6 sm:py-10">
      <DisplayTitle id="como-title" className="text-center">
        ¿Cómo <em>subo</em> mi catálogo?
      </DisplayTitle>

      <div className="mt-8 grid gap-6 md:grid-cols-2 md:gap-8">
        <article className={`${card} bg-leaf-soft`}>
          <div>
            <p className={sub}>Opción A</p>
            <h3 className="font-display text-[clamp(2rem,4vw,2.6rem)] leading-none">Tú</h3>
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <CheckList
              items={[
                "Creas tu cuenta y armas tu perfil.",
                "Subes tus prendas una por una o todas con un Excel.",
                "Etiquetas ocasión, estilo y clima, y armas looks.",
                instagramLive ? (
                  "Importas tus fotos desde Instagram."
                ) : (
                  <>
                    Importar desde Instagram <SoonBadge className="ml-1 align-middle" />
                  </>
                ),
              ]}
            />
            <div>
              <p className={`${sub} mb-2`}>Tú pones</p>
              <CheckList dashed items={["Fotos, precios y tallas.", "El enlace a tu tienda o tu WhatsApp."]} />
            </div>
          </div>
          <p className="border-t border-dashed border-ink/30 pt-3 text-[13px] text-ink/70">
            Revisamos cada perfil antes de publicarlo.
          </p>
          <div>
            <CtaLink href="/signup?tipo=marca" variant="forest">
              Crea tu cuenta
            </CtaLink>
          </div>
        </article>

        <article className={`${card} bg-blush`}>
          <span className="absolute -top-4 right-5 rotate-6 rounded-xl border-[1.5px] border-ink bg-honey px-3 py-1.5 text-center text-sm font-bold tracking-[0.14em]">
            GRATIS
            <span className="block text-[11px] font-medium tracking-normal">por ahora</span>
          </span>
          <div>
            <p className={sub}>Opción B</p>
            <h3 className="font-display text-[clamp(2rem,4vw,2.6rem)] leading-none">Nosotros</h3>
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <CheckList
              items={[
                "Leemos tu catálogo desde tu tienda online o tu Excel.",
                "Subimos fotos, precios, tallas y etiquetas por ti.",
                "Te mostramos todo antes de publicarlo.",
              ]}
            />
            <div>
              <p className={`${sub} mb-2`}>Tú pones</p>
              <CheckList dashed items={["El enlace a tu tienda o tu Excel.", "Un WhatsApp o correo para coordinar."]} />
            </div>
          </div>
          <p className="border-t border-dashed border-ink/30 pt-3 text-[13px] text-ink/70">
            Revisamos cada perfil antes de publicarlo.
          </p>
          <AssistedRequest />
        </article>
      </div>
    </section>
  );
}

// ── Tu panel ─────────────────────────────────────────────────────────────────
export function BrandPanelPreview() {
  const rows = [
    { k: "Prendas publicadas", v: "34", c: "bg-coral" },
    { k: "Looks", v: "8", c: "bg-honey" },
    { k: "Borradores", v: "5", c: "bg-leaf" },
  ];
  return (
    <section aria-labelledby="panel-title" className="py-12 sm:py-20">
      <DisplayTitle id="panel-title" className="mb-7 text-center">
        Tu <em>panel</em>
      </DisplayTitle>
      <div className="grid gap-4 md:grid-cols-[1.25fr_.75fr] md:gap-8">
        <div
          aria-hidden
          className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-4 rounded-3xl border-[1.5px] border-ink bg-cream p-4 sm:p-5"
        >
          <div
            className="relative aspect-square w-[clamp(5.25rem,11vw,7.5rem)] rounded-full after:absolute after:inset-[26%] after:rounded-full after:bg-cream"
            style={{
              background:
                "conic-gradient(var(--color-coral) 0 34%, var(--color-honey) 0 58%, var(--color-leaf) 0 86%, var(--color-sky) 0)",
            }}
          />
          <div className="flex flex-col gap-2 text-[13px]">
            {rows.map((r) => (
              <div key={r.k} className="flex justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-[3px] ${r.c}`} />
                  {r.k}
                </span>
                <b>{r.v}</b>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-sky" />
                Estado del perfil
              </span>
              <span className="rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-medium text-forest">Aprobado</span>
            </div>
          </div>
          <div className="col-span-2 grid grid-cols-3 gap-2.5">
            {[
              ["34", "prendas", "bg-coral-soft"],
              ["8", "looks", "bg-honey-soft"],
              ["IG", "conectado", "bg-leaf-soft"],
            ].map(([n, l, bg]) => (
              <div key={l} className={`rounded-[14px] border-[1.5px] border-ink px-3 py-2.5 ${bg}`}>
                <b className="font-display block text-3xl leading-none font-normal">{n}</b>
                <span className="text-xs text-ink/60">{l}</span>
              </div>
            ))}
          </div>
          <div className="col-span-2 text-xs">
            Espacio usado · 22 %
            <div className="mt-1 h-2 overflow-hidden rounded bg-ink/10">
              <div className="h-full w-[22%] bg-forest" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border-[1.5px] border-ink bg-honey-soft p-5">
          <h3 className="font-display text-[28px] leading-tight">Todo tu catálogo en un lugar</h3>
          <div className="text-sm">
            <CheckList
              items={[
                "Resumen de prendas, looks y borradores.",
                "Estado de revisión de tu perfil.",
                "Conexión con Instagram.",
                "Espacio usado por tus fotos.",
              ]}
            />
          </div>
          <div className="flex flex-col gap-1 text-sm text-ink/70">
            <SoonBadge />
            Cuántas personas fueron a tu tienda o tu WhatsApp desde Icon.
          </div>
        </div>
      </div>
    </section>
  );
}

// ── tu post → la prenda → tu página / tu WhatsApp ────────────────────────────
export function PostToStoreFlow({ photos }: { photos: LandingPhoto[] }) {
  const main = photos[0];
  const lbl = "text-xs font-semibold tracking-[0.12em] text-ink/60 uppercase";
  const arrow = "w-[clamp(1.75rem,5vw,3.75rem)] justify-self-center text-coral max-md:rotate-90";
  return (
    <section aria-labelledby="flow-title" className="pb-12 sm:pb-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <DisplayTitle id="flow-title">
          De tu publicación <em>a tu tienda</em>.
        </DisplayTitle>
        <p className="max-w-[54ch] text-ink/70 sm:text-lg">
          Cada prenda etiquetada lleva directo a tu página o tu WhatsApp. Icon registra cada clic.
        </p>
      </div>
      <div aria-hidden className="mt-8 grid items-center gap-3 md:grid-cols-[1fr_auto_1fr_auto_1.1fr] md:gap-5">
        <div className="flex flex-col items-center gap-2">
          <span className={lbl}>Tu post en el feed</span>
          <div className="grid w-full max-w-[220px] grid-cols-2 gap-1.5 rounded-[20px] border-[1.5px] border-ink bg-cream p-2.5">
            {[1, 0, 2, 3].map((idx, k) => (
              <Photo
                key={k}
                photo={photos[idx]}
                i={idx}
                className={`h-20 rounded-[10px] ${idx === 0 ? "outline-[3px] outline-offset-2 outline-coral outline" : ""}`}
              />
            ))}
          </div>
        </div>
        <CurvedArrow className={arrow} />
        <div className="flex flex-col items-center gap-2">
          <span className={lbl}>La prenda</span>
          <div className="relative w-full max-w-[200px] rounded-[20px] border-[1.5px] border-ink bg-cream p-2.5">
            <Photo photo={main} i={2} className="h-44 rounded-xl" />
            {main && (
              <span className="absolute top-[38%] left-[46%] max-w-[50%] truncate rounded-full border-[1.5px] border-ink bg-cream px-2 py-0.5 text-[11px] font-semibold">
                <span className="mr-1 inline-block size-[7px] rounded-full bg-coral" />
                {main.title}
              </span>
            )}
            <div className="mt-2 flex justify-between gap-2 text-[13px]">
              <b className="truncate">{main?.title ?? "Tu prenda"}</b>
              <span>{formatCop(main?.price ?? null)}</span>
            </div>
          </div>
        </div>
        <CurvedArrow className={arrow} />
        <div className="flex w-full flex-col gap-3.5">
          <div>
            <span className={lbl}>Tu página</span>
            <div className="mt-1 overflow-hidden rounded-2xl border-[1.5px] border-ink bg-cream">
              <div className="flex gap-1.5 border-b-[1.5px] border-ink bg-sky px-2.5 py-2">
                {[0, 1, 2].map((d) => (
                  <i key={d} className="size-2 rounded-full border border-ink bg-cream" />
                ))}
              </div>
              <div className="flex flex-col gap-1.5 p-2.5">
                <div className="h-2 w-3/5 rounded bg-ink/15" />
                <div className="h-2 w-[85%] rounded bg-ink/15" />
                <span className="self-start rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white">Comprar</span>
              </div>
            </div>
          </div>
          <div>
            <span className={lbl}>Tu WhatsApp</span>
            <div className="mt-1 flex flex-col rounded-2xl border-[1.5px] border-ink bg-leaf-soft p-2.5 text-[13px]">
              <span className="max-w-[90%] self-end rounded-[12px_12px_2px_12px] bg-leaf px-2.5 py-1.5">
                Hola, vi {main ? `“${main.title}”` : "tu prenda"} en Icon. ¿Hay talla M?
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
