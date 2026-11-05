# Implementation Plan: Landings públicas para personas y para marcas

**Branch**: `landings` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-public-landings/spec.md`

## Summary

Reemplazar la landing mixta de `/` por dos landings: **personas** en `iconcolombia.com/` y **marcas** en
`iconcolombia.com/marcas`. Siguen el boceto `Note 4_11_2026.pdf` y la maqueta aprobada
([mockups/landings.html](./mockups/landings.html), 2026-11-04). Las dos capturan interés (subida
asistida y postulación de marca), avisan al equipo por WhatsApp y miden visitas, clics y envíos.

Enfoque técnico (detalle y alternativas en [research.md](./research.md)):

1. **Server components con SSR** en `/` y `/marcas` (SEO, FR-038). La sesión solo cambia el CTA
   principal (FR-003) mediante `getCurrentUser()`, que ya está cacheado por petición.
2. **Secciones como componentes** en `src/components/landing/`. Las ilustraciones son SVG con los tokens
   de la paleta. Las fotos son prendas reales publicadas, leídas de `feed_items` y servidas con `imageUrl()`.
3. **Tipografía display**: Instrument Serif vía `next/font/google` como token `--font-display` en
   `globals.css`. El wordmark se engruesa con `-webkit-text-stroke`.
4. **Captura de interés por RPC `security definer`** (`submit_brand_request`), sin acceso directo de
   `anon` a la tabla. La RPC valida, deduplica (clave de idempotencia + marca ya existente), limita la
   frecuencia por IP con hash y guarda solo lo pedido.
5. **Aviso al grupo por CallMeBot** (WhatsApp personal), en segundo plano con `after()` de
   `next/server`. Es un mensaje **sin datos personales** del contacto: tipo, marca, ciudad y enlace a
   `/admin?tab=solicitudes`.
6. **Analítica propia**: `landing_events` (sin datos personales) vía la RPC `track_landing_event`,
   llamada desde un route handler con `navigator.sendBeacon`. Se ve en una pestaña nueva de `/admin`.
   Las visitas siguen también en Vercel Analytics.
7. **Prueba social**: RPC `landing_stats()` que devuelve agregados con el umbral aplicado en el
   servidor (10 marcas · 50 publicaciones · 100 personas).
8. **Compartir y SEO**: `opengraph-image.tsx` por ruta (`next/og`), `metadataBase` =
   `https://iconcolombia.com`, `sitemap.ts` y `robots.ts`.
9. **`/privacidad`**: borrador del aviso de tratamiento de datos (Ley 1581). Su revisión legal es
   **puerta de release** a `main`.

## Technical Context

**Language/Version**: TypeScript 5, React 19.2, Node 20+ (runtime Node de Vercel)

**Primary Dependencies**: Next.js 16 (App Router, server actions, `after()`, `next/og`, `next/font`),
`@supabase/ssr` + `supabase-js`, Tailwind v4, shadcn/ui (ya instalados), `@vercel/analytics` (ya
instalado). **Sin dependencias nuevas.**

**Storage**: Postgres (Supabase): tablas nuevas `brand_requests` y `landing_events`. RPC nuevas
`submit_brand_request`, `track_landing_event`, `landing_stats`, `landing_event_summary` y
`brand_request_list`. Sin R2 nuevo: las fotos son claves R2 ya existentes.

**Testing**: no hay suite automatizada (`TODO(TESTS)`). Se verifica con `npm run lint`,
`npm run build` y los escenarios de [quickstart.md](./quickstart.md), además de Lighthouse móvil y
revisión de accesibilidad con teclado.

**Target Platform**: Vercel (dominio `iconcolombia.com`, ya conectado) + Supabase cloud.

**Project Type**: aplicación web Next.js full-stack.

**Performance Goals**: contenido principal en menos de 3 s en 4G (SC-006); LCP del hero = texto (el
wordmark es texto, no imagen); fotos `loading="lazy"` bajo el pliegue; JS de cliente mínimo (formularios,
rotación del globo, tracker).

**Constraints**: hero visible sin scroll en 360×640 y 1366×768 (FR-004); sin scroll horizontal a 360 px;
`prefers-reduced-motion`; la analítica no puede romper la navegación (FR-031); CallMeBot no puede
bloquear ni hacer fallar el envío.

**Scale/Scope**: 10 marcas / 100 usuarios; decenas de solicitudes por mes; eventos de orden de miles por
mes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|---|---|---|
| I. Tres pilares | Nombrados en el spec: **local/independiente**, **intención** y **curaduría/estética**. | ✅ |
| II. Conectar, no vender | El copy dice "Vende en tu canal" y "Compra directo a la marca". `/out/[garmentId]` y `outbound_clicks` no cambian; los clics en prendas de la landing pasan por `/out` o `/prenda`. | ✅ |
| III. Acceso mínimo (NON-NEGOTIABLE) | Las tablas nuevas tienen RLS + GRANT. `anon` **no** tiene acceso a tablas: solo `EXECUTE` sobre RPC `security definer` acotadas (insertar validado; estadísticas agregadas con umbral). La lectura es solo para `is_staff()`. Sin `service_role` en la app. Las RPC fijan `search_path`. | ✅ |
| IV. Esquema fuente de verdad | Migración nueva `20261105000000_landings.sql`. `database.types.ts` se actualiza a mano en el mismo commit. Las fotos se leen de `feed_items` (no de `posts`). **Orden**: migración a la nube → merge. | ✅ |
| V. Imágenes por el pipeline | No se suben imágenes; solo se muestran claves R2 existentes con `imageUrl()` (sin URLs de R2 hardcodeadas). Las ilustraciones son SVG en código. Las OG se generan en runtime con `next/og`. | ✅ |
| VI. Un solo sistema visual | Solo tokens de `globals.css`. **Se añade** el token `--font-display` (Instrument Serif) al `@theme`, tal como permite FR-033. Usa `Aurora`, `.glass` y `.glass-input`; sin librería nueva. | ✅ |
| VII. Español inclusivo | Copy revisado ("persona", "quien…"). Los errores de formulario están en español. | ✅ |
| VIII. Alcance | Lo que queda fuera está declarado en el spec. "Comparte tu estilo", "Reseñas", "Importar desde Instagram" y "Clics en tu panel" solo como **Próximamente**. CallMeBot es una integración externa justificada (operación de respuesta el mismo día), apagable por variable de entorno. | ✅ |

**Gate**: pasa.

**Re-evaluación post-diseño (Phase 1)**: sin cambios. Riesgo anotado: CallMeBot es un servicio de
terceros no oficial; por eso el mensaje no lleva datos personales y la operación no depende de él (la
fuente de verdad es `/admin`).

## Project Structure

### Documentation (this feature)

```text
specs/002-public-landings/
├── spec.md
├── plan.md              # este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── rpc.md           # RPC de Postgres (firma, permisos, errores)
│   └── http-and-events.md  # server actions, /api/landing-event, catálogo de eventos, CallMeBot
├── checklists/requirements.md
└── mockups/landings.html   # maqueta aprobada
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20261105000000_landings.sql        # tablas + RLS + GRANT + RPC

src/app/
├── page.tsx                           # REESCRITO: landing personas
├── opengraph-image.tsx                # OG de /
├── marcas/
│   ├── page.tsx                       # NUEVO: landing marcas
│   └── opengraph-image.tsx
├── privacidad/page.tsx                # NUEVO: borrador aviso Ley 1581
├── landing/actions.ts                 # server actions: submitAssisted, submitNomination
├── api/landing-event/route.ts         # POST (sendBeacon) → track_landing_event
├── sitemap.ts · robots.ts             # NUEVOS
├── layout.tsx                         # + Instrument Serif, metadataBase
├── globals.css                        # + --font-display, utilidad .wordmark
└── admin/
    ├── admin-tabs.tsx                 # + pestañas "Solicitudes" y "Landings"
    └── _components/requests-tab.tsx · landing-metrics-tab.tsx

src/components/landing/
├── landing-header.tsx                 # header glass + switch "Soy persona / Tengo una marca"
├── hero.tsx                           # ICON + 3 pasos + líneas al horizonte (SVG) + CTA
├── dialogue-scene.tsx                 # "Necesito un…" / "Quiero algo para…"
├── illustrations.tsx                  # SVG: personas, camiseta, caja, marcador, flecha
├── feature-section.tsx · soon-badge.tsx
├── nomination-form.tsx                # cliente
├── assisted-request.tsx               # cliente (botón Solicitar + formulario + confirmación)
├── brand-panel-preview.tsx · post-to-store-flow.tsx
├── stats-strip.tsx · brand-logos.tsx
├── landing-footer.tsx                 # pie ondulado
└── track.tsx                          # cliente: page_view + clics data-track (sendBeacon)

src/lib/
├── landing.ts                         # getLandingStats, getLandingPhotos, getActiveBrandLogos
├── notify.ts                          # notifyTeam() vía CallMeBot (server-only)
└── database.types.ts                  # + tablas y Functions nuevas
```

**Structure Decision**: un solo proyecto Next.js, igual que el resto del repo. Las secciones de landing
viven en `src/components/landing/` porque ambas rutas las comparten (hero, escena, pie, formularios).

## Migraciones y orden de despliegue

1. `20261105000000_landings.sql`: aplicar a **Supabase cloud** (MCP) antes de mergear a `dev`.
2. Variables de entorno en Vercel (Preview + Production): `NEXT_PUBLIC_SITE_URL=https://iconcolombia.com`,
   `CALLMEBOT_RECIPIENTS` (ver contrato), `LANDING_IP_SALT`.
3. Supabase Auth → URL Configuration: Site URL = `https://iconcolombia.com` (+ Redirect URLs
   `https://iconcolombia.com/**`; se mantiene la de `*.vercel.app` para los Preview).
4. **Puertas de release a `main`**: texto de `/privacidad` revisado por quien lleve lo legal. Las
   landings se revisan en el dominio de producción o con la protección de Preview desactivada (FR-001).

## Complexity Tracking

| Añadido | Por qué | Alternativa más simple descartada |
|---|---|---|
| RPC `security definer` en lugar de una policy `insert` para `anon` | Permite validar, deduplicar, limitar la frecuencia y responder "ya está en Icon" sin dar a `anon` lectura de la tabla. | Una policy `insert` deja pasar cualquier payload y no permite el aviso de duplicado. |
| Tabla `landing_events` propia | Los eventos personalizados de Vercel exigen plan Pro; la tabla propia resiste bloqueadores (mismo origen) y se ve en `/admin`. | Vercel `track()` (plan Pro, no funciona con bloqueadores). |
| CallMeBot | El equipo solo tiene WhatsApp personales y promete respuesta el mismo día hábil. | WhatsApp Cloud API (exige número Business verificado). |
