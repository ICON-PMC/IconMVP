# Icon — handoff para el equipo

Este archivo es la puerta de entrada para cualquier persona nueva en el proyecto. `CLAUDE.md` tiene
guía más detallada para trabajar con Claude Code, pero **está en `.gitignore`** (es local, no llega
al repo) — así que este documento es la fuente que sí ve todo el equipo.

Si algo aquí no cuadra con el código, el código manda: este archivo se desactualiza más rápido que
`supabase/migrations/`.

## Qué es Icon, en dos frases

Plataforma tipo Pinterest para descubrir **moda colombiana independiente** con intención de compra
(ocasión, ciudad, precio, estilo) — no solo inspiración. MVP **curado**: el equipo carga el contenido,
no las marcas ni los usuarios. Español primero. Nicho inicial: Barranquilla, Medellín, Bogotá.

**El objetivo ahora mismo no es construir más funciones — es conseguir que marcas y usuarios reales
lo usen y nos digan qué falla.** Ver `TODO.md` para el camino a ese punto.

## Arrancar en 10 minutos

Requisitos: Node 20+, Docker, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
git clone https://github.com/awangran/Icon.git
cd Icon
git checkout dev              # se trabaja en dev, nunca directo en main

supabase start                # levanta Postgres local en Docker
supabase db reset             # aplica todas las migraciones + seed de datos de muestra

cp .env.example .env.local    # pega los valores que imprime `supabase status`
npm install
npm run dev                   # http://localhost:3000
```

El seed (`supabase/seed.sql`) **no crea cuentas**. Para probar en local:

1. Regístrate en `/signup` (con `enable_confirmations = false` entras directo).
2. Para volverte staff, cambia tu rol en SQL. El trigger `users_protect_role_field` revierte el
   cambio si no eres staff, así que desactívalo solo para esa sesión:
   ```bash
   docker exec $(docker ps --format '{{.Names}}' | grep supabase_db) psql -U postgres -c \
     "set session_replication_role = replica; update public.users set role = 'curator' where email = 'tu@correo.co';"
   ```
3. Con rol `curator`/`admin` entra a `/admin`. Para datos de muestra: `npm run db:import`
   (necesita `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`; el valor local sale de `supabase status`).

## El stack, en una tabla

| Capa | Qué es | Dónde vive |
|---|---|---|
| App | Next.js 16 (App Router, TypeScript, Tailwind v4) | `src/` |
| Datos + auth | Supabase / Postgres | `supabase/migrations/` |
| Imágenes | Cloudflare R2 (egress gratis) | `src/lib/r2.ts`, `src/lib/upload.ts` |
| Deploy app | Vercel, auto-deploy desde GitHub | rama `main` → producción |
| Deploy datos | Supabase cloud (ref `oyzvuckkxzbufncvzcvw`) | manual — ver abajo |

**Producción:** https://icon-iota-two.vercel.app

## Cómo se mueve el código

```
dev (trabajo diario, push = preview deployment en Vercel)
 └─ merge → main (= producción, auto-deploy)
```

Reglas:
1. **Todo el trabajo va a `dev`.** `main` es solo el espejo de lo que está en producción.
2. **Las migraciones de base de datos se aplican a la nube ANTES de mergear el código que las usa.**
   Si el código llega primero, la app en producción falla contra un esquema que todavía no existe.
3. Un release es un merge `dev` → `main`.

### Aplicar una migración nueva a la nube

**Orden y re-ejecución:** aplica las migraciones en orden de timestamp y *todas* las anteriores primero. Una migración que solo hace `create or replace` no falla si le falta una dependencia (falla después, en runtime). Si aplicas una migración vieja después de una nueva, puede sobrescribir funciones que la nueva redefinió (`protect_brand_curation_fields`, `protect_user_role_field`): vuelve a correr esas definiciones. Antes de dar por buena una migración en la nube, compara con `select proname from pg_proc` / `pg_policies` / `pg_trigger`.

No hay connection string compartido, así que hay dos caminos:
- Pegar el SQL en el **SQL Editor** de Supabase (proyecto `oyzvuckkxzbufncvzcvw`), o
- Usar el **MCP de Supabase** si tu sesión de Claude Code lo tiene conectado (`/mcp` para autenticar).

Después de aplicar, guarda el mismo SQL como archivo nuevo en `supabase/migrations/` con timestamp,
para que el repo quede en sync con lo que ya corrió en la nube.

## El modelo de datos en un párrafo

Un **post** es una foto de outfit. Sus prendas se taggean en **post_items** (con la talla que se
compró), y cada prenda es un **garment** del catálogo de una **brand**. La taxonomía (categoría,
ocasión, estilo, temperatura) vive en una sola tabla, **tags**, distinguida por `type`. El feed no
lee la tabla `posts` directo — lee la vista **`post_feed`**, que ya trae todo agregado (tags, precios,
ciudad, imagen) y un campo `score` (popularidad + qué tan reciente es) para ordenar.

19 tablas, 3 vistas, 3 funciones de búsqueda y 2 RPC de revisión de marcas. El detalle línea por línea está en
`supabase/migrations/` (es la fuente de verdad) — no lo dupliques leyendo esto, es solo el mapa.

### Los roles

| Rol | Puede |
|---|---|
| `user` | Ver contenido publicado, guardar, comentar sus preferencias en onboarding |
| `brand` | Ver/editar solo su propia marca, prendas y posts (RLS por `brands.owner_user_id`, `is_brand_owner()`) |
| `curator` | Todo lo de `user` + cargar/editar marcas, prendas, posts y **aprobar/rechazar marcas** en `/admin` |
| `admin` | Todo lo anterior + ver analítica de clics |

### Registro de marcas y cola de aprobación

Flujo (spec en `specs/2026-09-19-brand-registration/`):

1. `/signup?tipo=marca` → cuenta + rol `brand`.
2. `/onboarding/marca`: perfil (paso 1) → portada (paso 2) → primera prenda + "Enviar para aprobación" (paso 3).
   La marca nace `status = 'pending'`, `is_active = false`; sus prendas quedan `pending`.
3. `/admin?tab=marcas` (staff): aprobar publica la marca y sus prendas en una transacción
   (`approve_brand`); rechazar guarda una nota opcional (`reject_brand`). Una marca rechazada edita y
   reenvía desde el banner de `/marca/panel`.

Reglas que hay que conocer:

- **`brands.status`** (`pending | active | rejected`) manda; `is_active` se deriva de él por trigger.
  Una marca nunca puede cambiar su propio `status` (salvo reenviar `rejected → pending`), `is_active`,
  `is_verified` ni `rejection_note`. Los triggers solo restringen a usuarios autenticados; `service_role`
  y SQL directo pueden gestionar el estado.
- **`brands.owner_user_id`** es la fuente de verdad de la propiedad; `users.brand_id` es un espejo
  mantenido por trigger (no lo escribas a mano).
- Una marca no aprobada no puede publicar prendas ni posts: los triggers `garments_protect_status` y `posts_protect_status` los dejan en `pending`/`draft` hasta que la marca sea `active`.
- La cola solo lista marcas con `submitted_at` no nulo (los registros a medias no aparecen).

## Lenguaje inclusivo

La audiencia de Icon no es solo mujeres: en UI, docs y comentarios se dice "usuario" (no "usuaria") y
se usan formulaciones neutras. Ver `specs/constitution.md` §1.

## UI: shadcn/ui

shadcn está instalado (`components.json`, `src/components/ui/`). Sus tokens se mapean a la paleta Icon
en `globals.css` (primary = forest, destructive = coral): no introduzcas colores paralelos. Ojo: si
`npx shadcn add …` genera `import { cn } from "cn"`, cámbialo a `@/lib/utils` (el paquete `cn` de npm
no es el helper de clsx/tailwind-merge) y quita esa dependencia de `package.json`.

## Gotchas que le van a morder a alguien nuevo

Estas cuatro cosas **no fallan en local** y sí fallan en producción — cuestan horas si no se conocen:

1. **`sharp` no se puede importar a nivel de módulo.** En el runtime serverless de Vercel, un
   `import sharp` arriba del archivo tira 500 en cualquier página que importe ese módulo, aunque
   sea de forma indirecta. Siempre `const { default: sharp } = await import("sharp")` dentro de la
   función que lo usa. Ya está resuelto así en `src/lib/upload.ts`; si tocas subida de imágenes, no
   lo deshagas.
2. **La subida a R2 necesita un `Blob`, no un `Buffer`, en el `fetch`.** El runtime de Vercel (undici)
   manda un `Buffer` con `Transfer-Encoding: chunked` y sin `Content-Length`, y R2 responde
   `411 MissingContentLength`. La solución (`src/lib/r2.ts`) firma con `AwsV4Signer` y envuelve los
   bytes en un `Blob` antes del `fetch`.
3. **`serverActions.bodySizeLimit` tiene que estar en `10mb`** en `next.config.ts`. El default de
   Next (1 MB) rechaza con 413 cualquier subida de foto normal.
4. **Las variables `NEXT_PUBLIC_*` se hornean en el build.** Si las cambias en Vercel (por ejemplo
   al rotar keys), hay que hacer **Redeploy sin build cache** — si no, el build viejo se sigue
   sirviendo con los valores anteriores.

Detalle completo de los tres gotchas de imágenes en la memoria del proyecto
(`icon-vercel-image-upload.md`, si tienes acceso a las notas de Claude Code) o revisando el historial
de commits sobre `/admin` y `src/lib/r2.ts`.

## RLS: el patrón que se repite en cada tabla nueva

Row Level Security está activo en todas las tablas. Dos reglas fijas:

- **Lectura pública solo de lo publicado**: `status = 'published'` en posts/garments, `is_active = true`
  en brands. Todo lo demás requiere ser `curator`/`admin` (función `is_staff()`).
- **RLS no sustituye los GRANT.** Supabase tiene el auto-expose de tablas nuevas desactivado, así que
  además de la policy, `anon`/`authenticated`/`service_role` necesitan un `GRANT` explícito o vas a
  ver `permission denied for table X` aunque la policy esté bien. Si agregas una tabla, copia el
  patrón de policies + grants de la migración inicial (`20260614120000_init.sql`).

## Variables de entorno

`.env.local` (nunca se commitea) necesita las variables de Supabase, R2 e Instagram — `.env.example`
trae la lista de nombres. Los correos transaccionales (aprobación/rechazo de marcas) aún no existen:
quedaron para una fase posterior (ver `specs/roadmap.md`); la marca ve el resultado en su panel. Para apuntar un script a la nube en vez de local:

```bash
NEXT_PUBLIC_SUPABASE_URL=<url_nube> SUPABASE_SERVICE_ROLE_KEY=<key_nube> npm run db:import
```

**Ojo con esto**: si pusiste las keys de producción en `.env.local` para probar algo, cualquier
`npm run db:*` que corras después escribe en la nube real, no en tu local.

## Dónde preguntar / qué leer primero

- `CLAUDE.md` (local, no está en git) — guía más larga si trabajas con Claude Code.
- `supabase/migrations/` — la verdad sobre el esquema, siempre por encima de lo que diga cualquier doc.
- `TODO.md` — qué falta para el primer lanzamiento con usuarios y marcas reales.

## Contexto de equipo

- Repo: `awangran/Icon` en GitHub.
- Responsable del proyecto: Ashlee (decide prioridades, config de producción, cuentas externas).
