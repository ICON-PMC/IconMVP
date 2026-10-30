# Icon Constitution

Icon es una plataforma de descubrimiento de moda colombiana independiente con intención de compra.
Español primero. Nicho inicial: Barranquilla, Medellín, Bogotá. Este documento gobierna cómo se
decide, se especifica y se construye; ante conflicto con otros documentos, gana este.

## Core Principles

### I. Los tres pilares son la puerta de entrada
Toda iniciativa — producto, diseño, infraestructura — MUST reforzar al menos uno de estos pilares,
y el spec MUST nombrar cuál:
- **Intención:** los filtros (ocasión, ciudad, precio, estilo, categoría) y la búsqueda son el producto.
- **Curaduría / estética:** contenido de marca nueva MUST pasar por la cola de aprobación de admin
  antes de ser visible; la calidad del catálogo vale más que su tamaño.
- **Local / independiente:** solo marcas colombianas independientes. Sin fast fashion ni cadenas.

Una propuesta que no refuerza ningún pilar MUST NOT entrar al backlog.
*Razón:* Icon compite por foco, no por amplitud; sin esta compuerta degenera en un feed genérico.

### II. Conectar, no vender
Icon MUST NOT procesar pagos, gestionar inventario ni envíos. Cada post y prenda MUST llevar a la
tienda o WhatsApp de la marca vía `/out/[garmentId]`, que registra el clic en `outbound_clicks`.
`outbound_clicks` es la métrica rectora del piloto; una feature que degrade su registro o su
atribución MUST NOT mergearse.
*Razón:* la hipótesis a validar es el arco "necesidad concreta → prenda → clic a comprar".

### III. Acceso mínimo y ciclo de vida del contenido (NON-NEGOTIABLE)
- El público (`anon`) MUST ver solo contenido `status = 'published'` y marcas con `is_active = true`.
  El ciclo es `draft → pending → published` (o `archived`).
- Toda tabla nueva MUST llevar policy RLS **y** `GRANT` explícito a `anon`/`authenticated`/`service_role`
  según corresponda (auto-expose está desactivado). Sin el par, la migración está incompleta.
- Los roles son `user`, `brand`, `curator`, `admin`. `is_staff()` (curator|admin) MUST NOT tener
  bypasses; una marca MUST poder ver/editar solo lo suyo (RLS por marca); solo `admin` cambia roles.
- La clave `SUPABASE_SERVICE_ROLE_KEY` MUST usarse solo en servidor y scripts; nunca con `NEXT_PUBLIC_`.
*Razón:* el contenido de terceros y las cuentas de marca exigen aislamiento a nivel de base de datos.

### IV. El esquema es la fuente de verdad
- `supabase/migrations/` manda sobre cualquier documento. El feed se lee por la vista `post_feed`
  (o `feed_items`) y la búsqueda por las RPC `search_*`; la UI MUST NOT leer `posts` directo para el feed.
- `src/lib/database.types.ts` se mantiene **a mano** y MUST actualizarse en el mismo commit que
  cada migración.
- **Orden de despliegue:** la migración MUST aplicarse a Supabase cloud (SQL Editor o MCP) **antes**
  de mergear el código que la usa. Las migraciones aplicadas MUST NOT editarse; se corrige con otra nueva.
- Sin ORM, sin GraphQL, sin caché externa: SQL directo vía vistas y RPC. Introducir cualquiera
  requiere enmienda de esta constitución.
*Razón:* un esquema con una sola fuente evita deriva y fallos en producción contra tablas inexistentes.

### V. Imágenes solo por el pipeline
- Toda imagen MUST subirse con `uploadToR2` (`src/lib/r2.ts`) tras resize WebP con `sharp`
  (hoy 1280 px, calidad 80 en `src/lib/upload.ts`) y mostrarse con `imageUrl()`. MUST NOT hardcodearse URLs de R2.
- `sharp` MUST importarse de forma lazy (`await import("sharp")`) dentro de la función que lo usa,
  nunca a nivel de módulo (rompe páginas en Vercel). `outputFileTracingIncludes` y
  `serverActions.bodySizeLimit: "10mb"` en `next.config.ts` MUST NOT eliminarse.
- `uploadToR2` MUST enviar `Blob` firmado con `AwsV4Signer` (un `Buffer` produce `411 MissingContentLength`).
- Las subidas MUST respetar la cuota por cuenta (marca 300 MB; usuario 50 MB al habilitarse la subida
  de usuarios) y MUST fallar con mensaje claro en español al alcanzarla. Se guarda la clave R2 y el peso.
*Razón:* estos fallos no aparecen en local y han causado incidentes reales en producción.

### VI. Un solo sistema visual
La estética es **glass/tropical**. Los componentes MUST usar los tokens de `src/app/globals.css`
(`--color-forest/leaf/coral/blush/cream`…) y las utilidades `.glass`/`.glass-input`; si falta un token
se añade ahí, no en el componente. Componentes base: `Aurora`, `GlassCard` y shadcn/ui. MUST NOT
introducirse un sistema de color o librería de UI paralelos. La UI MUST funcionar en móvil.
*Razón:* la UI premium es parte del pilar de curaduría; la coherencia visual no es opcional.

### VII. Español e inclusivo
Todo texto visible, mensaje de error, spec y comentario MUST estar en español y usar lenguaje
inclusivo: "usuario" (no "usuaria"), formulaciones neutras ("te damos la bienvenida", "quien…"),
sin asumir género de usuarios, marcas ni personas del equipo. La audiencia no es solo mujeres.
*Razón:* regla de producto y copy establecida por el equipo.

### VIII. Alcance disciplinado por señal, no por tiempo
Las fases del roadmap (0 Fundación ✅, 1 Usuarios creadores, 2 Comunidad y confianza, 3 Monetización)
avanzan al cumplirse su criterio de salida, no por calendario. Hasta nueva decisión explícita están
fuera de alcance: PWA instalable, búsqueda semántica (pgvector), dominio propio de imágenes, pagos o
inventario, y expansión fuera de Colombia. Cada spec MUST declarar su alcance y lo que deja fuera.
*Razón:* con escala objetivo de 10 marcas y 100 usuarios, la complejidad prematura es el mayor riesgo.

## Restricciones Técnicas

- **Stack:** Next.js 16 (App Router, TypeScript, Tailwind v4, server actions), Supabase/Postgres y
  Supabase Auth, Cloudflare R2, Vercel. Búsqueda con `pg_trgm` + `unaccent`.
- **Auth:** email+password activo; Google OAuth cableado pero sin credenciales. La sesión se refresca en
  `src/proxy.ts` (convención Next 16; no crear `middleware.ts`).
- **Variables de entorno:** los nombres viven en `.env.example`. `NEXT_PUBLIC_*` se hornean en el build:
  si cambian, Redeploy **sin** build cache. Ningún secreto se commitea.
- **Integraciones externas:** la importación de Instagram queda tras `INSTAGRAM_IMPORT_ENABLED`
  (solo Preview hasta la aprobación de Meta); los tokens MUST permanecer server-side.
- **Rutas públicas** (`/`, `/feed`, `/post/[id]`, `/prenda/[id]`, `/marca/[slug]`) deben ser SSR y
  responder 404 decente ante IDs inválidos; las rutas de panel (`/admin`, `/marca/panel`) MUST validar rol en servidor.

## Flujo de Desarrollo

- **Ramas:** el trabajo va a ramas de feature → `dev` (preview deployments en Vercel). `main` es
  producción; el release es merge `dev` → `main`. La línea de referencia es `origin/dev`.
- **Specs:** cada feature se crea con Spec Kit (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks`)
  en `specs/NNN-nombre/` (ruta fija de Spec Kit). El plan MUST listar las migraciones y su orden de
  despliegue. El contexto de producto vive en `.specify/memory/` (`mission`, `roadmap`, `tech-stack`).
  Los 8 features previos a Spec Kit están archivados, solo lectura, en `docs/legacy-specs/`.
- **Puertas de calidad antes de merge:** `npm run lint` y `npm run build` MUST pasar; los criterios de
  `validations.md` MUST verificarse en local (Supabase local con `supabase db reset`) y registrarse.
  TODO(TESTS): no hay suite automatizada; añadir una requiere enmienda MINOR.
- **Smoke test de release:** tras merge a `main`, verificar `/feed`, una ruta 404, login con contraseña
  incorrecta, una subida de imagen y que el clic saliente quede registrado.
- **Commits:** mensajes descriptivos; `CLAUDE.md` es local (en `.gitignore`), `HANDOFF.md` es la guía del equipo.

## Governance

Esta constitución prevalece sobre `.specify/memory/{mission,roadmap,tech-stack}.md`, `HANDOFF.md`, `CLAUDE.md` y cualquier otra
guía. Si discrepan, se corrige el otro documento (las migraciones siguen mandando sobre el esquema).

- **Enmiendas:** se proponen por PR a `.specify/memory/constitution.md` con justificación y, si
  cambian reglas vigentes, plan de migración del código afectado. Requieren aprobación de la dueña
  del producto.
- **Versionado (semver):** MAJOR = eliminar o redefinir un principio de forma incompatible;
  MINOR = nuevo principio/sección o guía materialmente ampliada; PATCH = aclaraciones y redacción.
- **Cumplimiento:** cada plan (`/speckit-plan`) MUST incluir una verificación contra estos principios y
  justificar cualquier excepción; los PR se revisan contra ellos. Complejidad añadida (nueva dependencia,
  tabla o servicio) MUST justificarse por el pilar que refuerza.
- **Revisión periódica:** al cerrar cada fase del roadmap se revisa esta constitución y se reconcilia
  con el estado del repo.

**Version**: 1.0.0 | **Ratified**: 2026-10-29 | **Last Amended**: 2026-10-29
