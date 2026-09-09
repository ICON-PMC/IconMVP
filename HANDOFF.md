# Icon — handoff para el equipo

Este archivo es la puerta de entrada para cualquier persona nueva en el proyecto. `CLAUDE.md` tiene
guía más detallada para trabajar con Claude Code, pero **está en `.gitignore`** (es local, no llega
al repo) — así que este documento es la fuente que sí ve todo el equipo.

Si algo aquí no cuadra con el código, el código manda: este archivo se desactualiza más rápido que
`supabase/migrations/`.

## Qué es Icon, en dos frases

Plataforma tipo Pinterest para descubrir **moda colombiana independiente** con intención de compra
(ocasión, ciudad, precio, estilo) — no solo inspiración. MVP **curado**: el equipo carga el contenido,
no las marcas ni las usuarias. Español primero. Nicho inicial: Barranquilla, Medellín, Bogotá.

**El objetivo ahora mismo no es construir más funciones — es conseguir que marcas y usuarias reales
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

Cuentas de prueba (local, contraseña `icon1234` para todas):

| Email | Rol |
|---|---|
| `admin@icon.co` | admin |
| `curadora@icon.co` | curator |
| `maria@icon.co`, `sofia@icon.co` | user |

Entra a `/admin` con la cuenta admin o curator para cargar contenido de prueba.

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

18 tablas, 3 vistas, 3 funciones de búsqueda. El detalle línea por línea está en
`supabase/migrations/` (es la fuente de verdad) — no lo dupliques leyendo esto, es solo el mapa.

### Los tres roles

| Rol | Puede |
|---|---|
| `user` | Ver contenido publicado, guardar, comentar sus preferencias en onboarding |
| `curator` | Todo lo anterior + cargar/editar marcas, prendas, posts en `/admin` |
| `admin` | Todo lo anterior + ver analítica de clics |

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

Row Level Security está activo en las 18 tablas. Dos reglas fijas:

- **Lectura pública solo de lo publicado**: `status = 'published'` en posts/garments, `is_active = true`
  en brands. Todo lo demás requiere ser `curator`/`admin` (función `is_staff()`).
- **RLS no sustituye los GRANT.** Supabase tiene el auto-expose de tablas nuevas desactivado, así que
  además de la policy, `anon`/`authenticated`/`service_role` necesitan un `GRANT` explícito o vas a
  ver `permission denied for table X` aunque la policy esté bien. Si agregas una tabla, copia el
  patrón de policies + grants de la migración inicial (`20260614120000_init.sql`).

## Variables de entorno

`.env.local` (nunca se commitea) necesita 9 variables — 3 de Supabase, 6 de R2 (`.env.example` trae
la lista de nombres). Para apuntar un script a la nube en vez de local:

```bash
NEXT_PUBLIC_SUPABASE_URL=<url_nube> SUPABASE_SERVICE_ROLE_KEY=<key_nube> npm run db:import
```

**Ojo con esto**: si pusiste las keys de producción en `.env.local` para probar algo, cualquier
`npm run db:*` que corras después escribe en la nube real, no en tu local.

## Dónde preguntar / qué leer primero

- `CLAUDE.md` (local, no está en git) — guía más larga si trabajas con Claude Code.
- `supabase/migrations/` — la verdad sobre el esquema, siempre por encima de lo que diga cualquier doc.
- `TODO.md` — qué falta para el primer lanzamiento con usuarias y marcas reales.

## Contexto de equipo

- Repo: `awangran/Icon` en GitHub.
- Dueña del proyecto: Ashlee (decide prioridades, config de producción, cuentas externas).
