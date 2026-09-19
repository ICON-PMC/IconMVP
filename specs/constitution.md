# Icon — Constitución del producto

> Este documento es la brújula. Cuando algo no está claro — una decisión de diseño, una prioridad,
> una restricción técnica — la pregunta es siempre: *¿refuerza alguno de los tres pilares?*
> Si la respuesta es no, la iniciativa puede esperar.

---

## 1. Qué es Icon

**Plataforma de descubrimiento de moda colombiana independiente con intención de compra.**

No es un feed de inspiración genérica. No es un marketplace. Es el puente entre una usuaria que sabe
qué quiere llevar a una ocasión específica y las marcas colombianas independientes que lo hacen.

**Diferenciadores no negociables:**
- **Intención** — los filtros (ocasión, ciudad, precio, estilo) son el producto, no un accesorio.
- **Curaduría** — todo el contenido pasa por el equipo antes de publicarse; la calidad visual manda.
- **Local/independiente** — solo marcas colombianas independientes. Sin fast fashion, sin cadenas.

---

## 2. Los tres pilares

Toda decisión — de producto, de diseño, de infraestructura — se evalúa contra estos tres ejes.
Una propuesta que no refuerza al menos uno no entra al backlog.

| Pilar | Qué significa en la práctica |
|---|---|
| **Intención** | Los filtros deben ser rápidos, precisos y relevantes para el momento de vida de la usuaria |
| **Curaduría / estética** | La UI es premium. El contenido que se publica pasa por revisión. La calidad del catálogo vale más que su tamaño |
| **Local / independiente** | Solo marcas colombianas no masivas. Cada decisión de alcance favorece profundidad en el nicho sobre amplitud geográfica o de categoría |

---

## 3. Modelo de negocio e hipótesis del piloto

**Hipótesis central:** una usuaria con una necesidad concreta (ej. "vestido para matrimonio en Medellín,
menos de $300 000") encuentra una prenda de una marca colombiana independiente y hace clic a comprar.

El piloto valida si ese arco completo funciona — no si la gente "pone likes".

**Métrica que importa en el piloto:** `outbound_clicks` (clic en "comprar" que lleva a la tienda de la
marca). Todo lo demás es secundario hasta que esa señal exista.

---

## 4. Modelo de contenido

### Jerarquía de entidades

```
brand           → la marca colombiana independiente
  └─ garment    → prenda del catálogo (con precio, talla, categoría, foto)
       └─ post  → foto de outfit curado que tagea ≥1 prenda
```

Un **post** es la unidad de inspiración. Una **prenda** es la unidad de compra. La usuaria entra por
el post, compra por la prenda.

### Taxonomía (tabla `tags`)

| `type` | Aplica a | Ejemplo |
|---|---|---|
| `category` | `garments` (1 por prenda) | vestido, blusa, pantalón |
| `occasion` | `posts` | matrimonio, playa, trabajo |
| `style` | `posts` | bohemio, minimalista, colorido |
| `temperature` | `posts` | frío, calor, tropical |

### Estado del contenido

Todo el contenido tiene ciclo de vida: `draft` → `pending` → `published` (o `archived`).
**Solo el contenido `published` es visible al público.** Las marcas activas tienen `is_active = true`.

---

## 5. Roles de usuario

| Rol | Permisos |
|---|---|
| `user` | Ver contenido publicado, guardar favoritos, personalizar perfil/onboarding |
| `curator` | Todo lo anterior + cargar/editar marcas, prendas, posts en `/admin` y `/admin/bulk` |
| `admin` | Todo lo anterior + ver analítica de clics |
| *(futuro)* `brand` | Ver/editar solo su propia marca, sus prendas y posts — RLS por `brand_id` |

`is_staff()` = role IN ('curator', 'admin'). Esta función se usa en RLS; no crearle bypasses.

---

## 6. Stack — por qué este y no otro

| Capa | Tecnología | Razón de la elección |
|---|---|---|
| App | Next.js 16 (App Router, TypeScript, Tailwind v4) | SSR para SEO de prendas/marcas; App Router para server actions sin API layer extra |
| Datos + auth | Supabase / Postgres | RLS nativo, auth integrada, buen DX local con CLI; sin ORM — SQL directo vía vistas y RPC |
| Imágenes | Cloudflare R2 | Egress gratis; resize con `sharp` en el server action antes de subir |
| Deploy | Vercel (app) + Supabase cloud | Auto-deploy desde GitHub; preview deployments en `dev` |

**Lo que no usamos y por qué:**
- Sin ORM (Prisma/Drizzle): las vistas y RPCs de Supabase ya dan lo que necesitamos con menos fricción.
- Sin GraphQL: la complejidad no se justifica con este esquema.
- Sin Redis/caché: el `score` de popularidad vive en Postgres via triggers; suficiente para el volumen del piloto.

---

## 7. Arquitectura de datos — invariantes que nunca se rompen

1. **`post_feed` es la vista de lectura del feed.** Nunca leer `posts` directo para la UI — la vista
   ya agrega tags, precios, ciudad, imagen y `score`. Las RPCs de búsqueda (`search_garments`,
   `search_posts`, `search_brands`) son la única excepción.

2. **RLS + GRANT siempre en par.** Toda tabla nueva necesita tanto la policy RLS como `GRANT` explícito
   para `anon`/`authenticated`/`service_role`. Supabase tiene auto-expose desactivado. Sin el GRANT,
   se ve `permission denied for table X` aunque la policy esté bien.

3. **Lectura pública solo de publicado.** `status = 'published'` en posts/garments, `is_active = true`
   en brands. Nunca exposer borradores al rol `anon`.

4. **`database.types.ts` se mantiene a mano.** `supabase gen types` del CLI 2.106 exige login. Después
   de cada migración, actualizar `src/lib/database.types.ts` en el mismo commit.

5. **Migraciones a la nube ANTES del código que las usa.** El orden es: aplicar SQL en Supabase cloud
   → mergear código → Vercel redeploya. Al revés, la app en producción falla contra un esquema inexistente.

6. **`sharp` solo como import lazy.** En el runtime serverless de Vercel, `import sharp` a nivel de
   módulo tira 500 en cualquier página que lo importe. Siempre `const { default: sharp } = await import("sharp")`
   dentro de la función que lo necesita.

7. **R2 con `Blob`, no `Buffer`.** El runtime de Vercel (undici) envía `Buffer` con `Transfer-Encoding: chunked`
   sin `Content-Length`, y R2 responde `411 MissingContentLength`. La subida usa `AwsV4Signer` + `Blob`.

---

## 8. Estética — tokens y componentes

El sistema visual se llama **glass/tropical**. Sus tokens viven en `src/app/globals.css`:

```
--color-forest  --color-leaf  --color-coral  --color-blush  --color-cream
```

Utilidades: `.glass` (panel semitransparente con blur), `.glass-input` (inputs con el mismo tratamiento).
Componentes base: `Aurora` (fondo animado), `GlassCard`.

**Regla de estética:** ningún componente nuevo introduce un sistema de color paralelo. Todo usa los tokens
de `globals.css`. Si falta un token, se añade ahí, no en el componente.

---

## 9. Rutas

| Ruta | Audiencia | Propósito |
|---|---|---|
| `/` | Pública | Landing |
| `/feed` | Pública | Feed masonry + 5 filtros + búsqueda |
| `/post/[id]` | Pública | Detalle de outfit |
| `/prenda/[id]` | Pública | Detalle de prenda + comprar |
| `/marca/[slug]` | Pública | Perfil de marca |
| `/saved` | Auth | Favoritos |
| `/login`, `/signup` | Auth | Autenticación |
| `/onboarding` | Auth (nuevo user) | Preferencias iniciales (ciudad + estilos) |
| `/settings` | Auth | Editar perfil |
| `/admin` | Staff | Panel de carga, métricas, analítica |
| `/admin/bulk` | Staff | Importación masiva de prendas vía `.xlsx` |
| `/out/[garmentId]` | Pública | Registra clic saliente → redirige a tienda |
| `/auth/callback` | Sistema | Callback OAuth |

---

## 10. Flujo de despliegue

```
dev (trabajo diario)
  └─ push → preview deployment en Vercel (URL única por commit)
  └─ merge → main → producción (icon-iota-two.vercel.app)
```

**Reglas de despliegue:**
- Todo el trabajo va a `dev`. `main` solo refleja producción.
- Aplicar migraciones a la nube **antes** de mergear el código que las usa.
- Variables `NEXT_PUBLIC_*` se hornean en el build → Redeploy sin build cache si cambian.

---

## 11. Qué está fuera de alcance hasta tener feedback del piloto

Estas iniciativas tienen entrada en el backlog pero no compiten con el objetivo del piloto:

- **Reviews / UGC** — `post_brand_reviews` existe en el esquema sin interfaz; se activa después.
- **PWA instalable** — falta los íconos PNG 192/512 y el service worker; cosmético para el piloto.
- **Búsqueda semántica** (pgvector/embeddings) — el trigram + unaccent ya resuelve acentos, plurales
  y errores de tipeo; suficiente para el volumen inicial.
- **Dominio propio para imágenes** — `pub-*.r2.dev` tiene rate limit; se nota solo con tráfico alto.
- **Paginación del feed** — `post_feed.select("*")` sin límite; aceptable mientras el catálogo sea chico.

La **próxima iniciativa decidida** después del piloto es **perfiles de marca con acceso propio**
(Instagram API o carga directa), que requiere: `users` ↔ `brand` (`brands.owner_user_id` o tabla
`brand_members`), rol `brand` con RLS nuevo, y panel `/marca/panel` para la marca.

---

## 12. Dónde vive la verdad

| Fuente | Qué describe |
|---|---|
| `supabase/migrations/` | Esquema de la base de datos — manda sobre cualquier doc |
| `src/lib/database.types.ts` | Tipos TypeScript del esquema — debe estar en sync con migrations |
| `HANDOFF.md` | Onboarding para el equipo — puede desactualizarse, migrations mandan |
| `TODO.md` | Tareas concretas para llegar al piloto |
| `specs/constitution.md` | Este archivo — principios y decisiones de diseño duraderas |
