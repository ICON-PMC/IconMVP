# Icon

Plataforma de descubrimiento de moda colombiana independiente (estilo Pinterest, curada).
Descubrimiento con intención: filtros por ocasión, ciudad, precio y estilo, en una experiencia visual y premium.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4) — desplegable en Vercel, PWA.
- **Supabase / Postgres** — datos y auth. Esquema en [`supabase/migrations/`](supabase/migrations).
- **Cloudflare Images** (pendiente) — almacenamiento y CDN de fotos; en la BD solo se guarda el `cf_image_id`.

## Requisitos

- Node 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) + Docker (para el entorno local)

## Puesta en marcha

```bash
# 1. Base de datos local (Postgres en Docker, aplica migración + seed)
supabase start
supabase db reset

# 2. Variables de entorno
cp .env.example .env.local   # y pega los valores de `supabase status`

# 3. App
npm install
npm run dev                  # http://localhost:3000
```

La página de inicio consulta la taxonomía sembrada para verificar la conexión con Supabase.

## Modelo de datos

`post` (foto de outfit) → `post_items` (prendas taggeadas) → `garments` (ítems del catálogo de una `brand`).
La taxonomía vive en `tags` (`category` por prenda; `occasion`/`style`/`temperature` por look). Detalle en `supabase/`.

- **Capa MVP (curada):** el equipo carga el contenido con la `service_role` key (omite RLS).
- **Capa futura (UGC):** posts de usuarios, tagging y verificación de marcas.

## Notas

- Los tipos de la BD están en `src/lib/database.types.ts` (escritos a mano; ver nota en el archivo para regenerarlos).
- RLS: lectura pública solo de contenido publicado; cada usuario gestiona sus guardados.
