# Icon — Stack técnico

## Capas y tecnologías

| Capa | Tecnología | Por qué |
|---|---|---|
| **App** | Next.js 16 (App Router, TypeScript) | SSR para SEO de marcas/prendas; server actions eliminan una capa de API; App Router da layouts anidados y loading states nativos |
| **Estilos** | Tailwind v4 + shadcn/ui | Tailwind para utilidades y tokens de diseño; shadcn para componentes accesibles sin overhead de librería completa |
| **Datos** | Supabase / Postgres | RLS por fila nativa, auth integrada, CLI para desarrollo local con Docker, vistas y RPCs sin necesidad de ORM |
| **Auth** | Supabase Auth | Email+password activo; Google OAuth cableado pero pendiente de credenciales |
| **Imágenes** | Cloudflare R2 + `sharp` | Egress gratis (vs S3); resize + conversión a WebP en el server action antes de subir; compatible con S3 API |
| **Deploy app** | Vercel | Auto-deploy desde GitHub; preview deployments por rama; `dev` = preview, `main` = producción |
| **Deploy DB** | Supabase cloud | Proyecto `oyzvuckkxzbufncvzcvw`; migraciones via SQL Editor o MCP |
| **Búsqueda** | Postgres (`pg_trgm` + `unaccent`) | Trigram + unaccent resuelve acentos, plurales y subcadenas sin infra extra; RPCs `search_garments`, `search_posts`, `search_brands` |

## Lo que deliberadamente no usamos

| Opción descartada | Por qué no |
|---|---|
| ORM (Prisma, Drizzle) | Las vistas y RPCs de Supabase ya dan lo que necesitamos; un ORM añade capa sin valor |
| GraphQL | Complejidad injustificada para este esquema |
| Redis / caché externa | La popularidad vive en Postgres via triggers; suficiente para el volumen del piloto |
| pgvector / embeddings | Búsqueda semántica es Fase 2; el trigram cubre los casos de uso del MVP |
| Service worker / PWA completa | Despriorizado hasta después del piloto |

---

## Límites de almacenamiento por cuenta

Los costos de R2 y base de datos escalan con el contenido — los límites protegen la infraestructura
hasta que entre monetización.

| Tipo de cuenta | Cuota total (acumulada) |
|---|---|
| Usuario | **50 MB** |
| Marca | **300 MB** |

- La cuota aplica al espacio total usado en R2 por esa cuenta, no al tamaño de un archivo individual.
- Al acercarse al límite, la UI debe avisar. Al alcanzarlo, el upload falla con mensaje claro.
- El sistema de membresía (roadmap) ampliará estas cuotas como parte del plan de pago.

---

## Optimización de imágenes

Icon es visualmente denso — el feed es masonry de imágenes. La velocidad de carga de imágenes
es una métrica de producto, no solo de infraestructura.

**Pipeline de subida:**
1. El server action recibe el archivo del cliente.
2. `sharp` (lazy import) redimensiona a máximo 1200px en el lado más largo y convierte a WebP con
   calidad 85. Esto reduce el tamaño típico de una foto de teléfono de ~4 MB a ~150-400 KB.
3. El WebP resultante se sube a R2. Solo se guarda la clave R2 en la base de datos.

**Pipeline de entrega:**
- `imageUrl()` en `src/lib/images.ts` construye la URL pública de R2.
- Next.js `<Image>` con `sizes` adecuados para el viewport — el navegador descarga solo la resolución
  que necesita.
- Placeholder tipo blur mientras carga (usar el `blurDataURL` de sharp o un color base).
- Dominio propio para R2 (en lugar de `pub-*.r2.dev`) cuando el tráfico justifique el rate limit.

**Regla:** ningún componente sube o muestra una imagen sin pasar por `uploadToR2` / `imageUrl()`.
No hardcodear URLs de R2 en el código.

---

## Gotchas operacionales — cosas que no fallan en local pero sí en Vercel

### 1. `sharp` solo como import lazy

En el runtime serverless de Vercel, un `import sharp` a nivel de módulo tira 500 en cualquier página
que importe ese módulo (aunque sea de forma transitiva).

**Siempre:**
```ts
const { default: sharp } = await import("sharp")
```
dentro de la función que lo necesita, nunca en el top del archivo.

`next.config.ts` ya tiene `outputFileTracingIncludes` para el `.so` de libvips — no eliminar.

### 2. R2 necesita `Blob`, no `Buffer`

El runtime de Vercel usa `undici` para `fetch`. Un `Buffer` se envía con `Transfer-Encoding: chunked`
sin `Content-Length`, y R2 responde `411 MissingContentLength`.

**La solución en `src/lib/r2.ts`:** firmar con `AwsV4Signer` y envolver en `new Blob([buffer])`
antes del `fetch`.

### 3. `serverActions.bodySizeLimit` debe ser `"10mb"`

El default de Next.js es 1 MB. Cualquier foto normal supera eso y recibe `413` silencioso.
Ya configurado en `next.config.ts` — no revertir.

### 4. `NEXT_PUBLIC_*` se hornean en el build

Las variables de entorno con ese prefijo se incrustan en el bundle en tiempo de build.
Si se rotan en Vercel, hay que hacer **Redeploy sin build cache** — el build viejo seguirá
sirviendo los valores anteriores si no.

---

## Patrón RLS + GRANT (repetir en cada tabla nueva)

Supabase tiene el auto-expose de tablas nuevas **desactivado**. Toda tabla necesita:

1. **Policy RLS** para leer/escribir según rol.
2. **GRANT explícito** a `anon`, `authenticated`, y/o `service_role`.

Sin el GRANT → `permission denied for table X` aunque la policy esté bien.

Plantilla en `supabase/migrations/20260614120000_init.sql`.

---

## Variables de entorno requeridas

`.env.local` (nunca se commitea). Los nombres están en `.env.example`.

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (local o cloud) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo server-side, scripts de carga) |
| `R2_ACCOUNT_ID` | ID de cuenta Cloudflare |
| `R2_ACCESS_KEY_ID` | Clave de acceso R2 |
| `R2_SECRET_ACCESS_KEY` | Secreto R2 |
| `R2_BUCKET_NAME` | Nombre del bucket |
| `R2_PUBLIC_URL` | URL pública del bucket (`pub-*.r2.dev`) |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Mismo valor, expuesto al cliente para construir URLs de imagen |
