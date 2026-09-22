# Plan — Feed mixto (outfits + prendas)

> **Notas que aplican a todos los grupos de tareas**
> - **Lenguaje inclusivo:** "usuario" (nunca "usuaria") y formulaciones neutras en UI, specs, comentarios y SQL. Ver `specs/constitution.md` §1.
> - **Migraciones:** se aplican a la nube **antes** de mergear el código que las usa (HANDOFF, regla 2). Después de aplicarlas, guardar el mismo SQL en `supabase/migrations/`.
> - **shadcn/ui:** componentes nuevos con `npx shadcn add …`; si genera `import { cn } from "cn"`, cambiar a `@/lib/utils`. Sin colores paralelos (primary = forest, destructive = coral).
> - Rama: `feat/mixed-feed` (creada desde `feat/brand-flow-ui-upgrade`, que no tenía diferencias con `main`).

## Objetivo

Que `/feed` sea un panel básico y agradable que mezcle **outfits (posts)** y **prendas (garments)** en un solo masonry, ordenado por una mezcla de popularidad y novedad, con filtros que no dominen la pantalla y sugerencias personalizadas arriba, estilo Pinterest.

## Decisiones (confirmadas con producto, 2026-09-21)

| Tema | Decisión |
|---|---|
| Mezcla | Un solo masonry con posts y prendas intercalados, ordenados juntos por `score`. |
| Orden por defecto | Mezcla popularidad + novedad (el `score` actual, extendido a prendas). Se mantiene el selector de orden (Relevante / Novedad / Popularidad / A–Z). |
| Filtros | Todos (Ocasión, Ciudad, Precio, Categoría, Estilo) dentro de un **panel plegable** tipo e-commerce, sin abrumar. Filtros activos como chips removibles sobre la grilla. |
| Sugerencias | Chips de aplicación rápida arriba de la grilla, basados en el onboarding (estilos en `user_preferences` + `users.home_city_id`). Un clic activa/desactiva el filtro. Visitantes sin sesión ven las etiquetas más populares. |
| Paginación | Scroll infinito, lotes de ~24. |
| Búsqueda (`?q=`) | Pestañas **Todo / Prendas / Outfits / Marcas**. "Todo" (mezclado) es la pestaña por defecto. Los filtros se conservan al cambiar de pestaña. |
| Popularidad de prendas | Triggers en `saved_garments` y `outbound_clicks` que suben `garments.popularity` igual que en posts (guardar +3, clic +1). |
| Muestras | Marcas de muestra (Bruma, Raíz, Marea) se **despublican, no se borran**, con una migración reversible. |
| Contenido real | Ya hay marcas reales aprobadas: el feed debe mostrar sus posts y prendas. |
| Alcance extra | Pulido de tarjetas + estados de carga / vacío / error. |

**Fuera de alcance (a propósito):** sesgo del ranking por preferencias del usuario (las sugerencias son solo chips), cargar más datos de muestra, comportamiento del ♡ para visitantes sin sesión (se revisa, pero no se rediseña aquí), reseñas/UGC, búsqueda semántica.

## Progreso
- [x] 1. Auditoría de datos (solo lectura) — completada con MCP de Supabase conectado (nube).
- [x] 2. Base de datos: popularidad de prendas + feed unificado
- [x] 3. Consulta paginada del feed (server)
- [x] 4. Grilla mixta con scroll infinito
- [x] 5. Panel de filtros plegable + chips activos
- [x] 6. Chips de sugerencias personalizadas
- [x] 7. Búsqueda con pestañas Todo / Prendas / Outfits / Marcas
- [x] 8. Pulido de tarjetas
- [x] 9. Estados de carga, vacío y error
- [x] 10. Despublicar marcas de muestra (nube) — aplicado 2026-09-21 (confirmado con Ashlee), migración
      `20260921010000_unpublish_sample_brands.sql`. Verificado: bruma/raiz/marea en `status='pending'`,
      `is_active=false`; `get_feed`/`bump_garment_popularity`/`popular_content_tags` ya viven en la nube.
- [~] 11. QA y regresión — `lint`/`next build` (incluye `tsc`) limpios; producción local
      (`next build` + `next start`) contra Supabase local, humo por `curl` hecho (ver nota).
      Falta: pase real en navegador (clicks, `Sheet` de filtros, scroll infinito), móvil, y
      más de 24 elementos (solo hay 9 en local).

**Decisiones abiertas resueltas (2026-09-21):** heredar ocasión/estilo del post para prendas;
sin patrón fijo de mezcla (solo `score`); tags populares calculadas del contenido para
visitantes; nomenclatura Outfits/Prendas.

**Nota de auditoría (grupo 1):** `post_images` sí guarda `width`/`height`; `garment_images` no — el
feed usa esas dimensiones cuando existen (posts) y una proporción fija `4/5` si no (prendas). El ♡
para visitante sin sesión redirige a `/login` vía el server action del botón
(`src/components/save-button.tsx`); no hay comportamiento local/optimista — sigue fuera de alcance,
sin cambios.

Confirmado en la nube (MCP de Supabase, 2026-09-21) — marcas `active`:

| slug | origen | `submitted_at` | posts publicados | prendas publicadas |
|---|---|---|---|---|
| `bruma` | seed de muestra (creada 2026-06-17, sin dueño) | `null` | 1 | 3 |
| `raiz` | seed de muestra (creada 2026-06-17, sin dueño) | `null` | 1 | 4 |
| `marea` | seed de muestra (creada 2026-06-17, sin dueño) | `null` | 1 | 2 |
| `marca-prueba` | registro real (dueño con email) | 2026-09-20 | 0 | 1 |
| `mi-marca` | registro real (dueño con email) | 2026-09-21 | 0 | 1 |

Los 3 slugs de muestra a despublicar en el grupo 10 son **bruma, raiz, marea** (sin `owner_user_id`
real, `submitted_at` nulo — coincide con el seed). Las dos marcas reales (`marca-prueba`,
`mi-marca`) sí tienen dueño real pero aún poco contenido publicado (0 posts, 1 prenda cada una) —
el feed mezclado seguirá viéndose mayormente con contenido de muestra hasta que se cargue más.

## Grupos de tareas

### 1. Auditoría de datos (solo lectura)
- Consultar la nube: marcas con `status = 'active'`, y cuántos posts/prendas `published` tiene cada una. Confirmar los slugs de las 3 marcas de muestra.
- Revisar si `post_images` / `garment_images` guardan ancho y alto (afecta el grupo 8).
- Revisar qué hace hoy el ♡ para un visitante sin sesión (`save-button.tsx` + acción) y anotar el hallazgo.
- **Criterio de salida:** lista de marcas reales con contenido, y decisión sobre dimensiones de imagen.

### 2. Base de datos
- **Popularidad de prendas:** función `bump_garment_popularity()` + triggers en `saved_garments` (±3) y `outbound_clicks` (+1, cuando `garment_id` no es nulo). Backfill con el conteo existente, igual que en `20260616120000_popularity_and_analytics.sql`.
- **Feed unificado:** función RPC `get_feed(...)` (o vista `feed_items` + RPC) que devuelva filas con `kind` (`post` | `garment`), `id`, `title/caption`, `image`, `brand_*`, `city_*`, precios, arreglos de tags y `score`.
  - `score` de prendas con la misma fórmula: `popularity + 5.0 / (1 + edad_en_días)`.
  - Parámetros: filtros (ciudad, precio, categoría, ocasión, estilo), `p_sort`, `p_limit`, `p_offset`.
  - Solo marcas `is_active = true` y contenido `published` (RLS con `security_invoker`, como `post_feed`).
- **Ocasión / Estilo en prendas:** las prendas no tienen esas etiquetas. *Propuesta:* una prenda cuenta como coincidencia si aparece en un post que las tiene (vía `post_items`). Ver "Preguntas abiertas".
- Actualizar `database.types.ts` a mano y aplicar con `supabase db reset` en local.
- **Paginación estable:** orden `score desc, id` con `offset`. El `score` cambia con el tiempo, así que puede haber un desplazamiento menor entre páginas; se acepta para el MVP.

### 3. Consulta paginada del feed
- `src/lib/feed.ts`: parsea `searchParams` → filtros/orden, llama a `get_feed`, devuelve `{ items, nextOffset }`.
- Route handler o server action para pedir la siguiente página con los mismos filtros.
- Sustituye la consulta directa a `post_feed` en `src/app/feed/page.tsx`. La primera página se renderiza en el servidor.

### 4. Grilla mixta con scroll infinito
- Componente cliente `FeedGrid`: recibe la primera página, observa un centinela con `IntersectionObserver` y pide más lotes.
- Masonry de columnas CSS (como hoy); renderiza `PostCard` o `GarmentCard` según `kind`.
- Se reinicia al cambiar filtros/orden (`key` derivada de los `searchParams`). Sin duplicados por `id`+`kind`.
- Indicador de "cargando más" y mensaje de fin de lista.

### 5. Panel de filtros plegable + chips activos
- Botón **"Filtros (n)"** que abre un panel (shadcn `Sheet`, cajón en móvil; agregar con `npx shadcn add sheet`). Dentro: los cinco grupos con conteo por grupo y botones "Aplicar" / "Limpiar".
- Fila de **chips activos removibles** sobre la grilla, más "Limpiar todo".
- La barra superior queda con: búsqueda, "Filtros (n)" y orden.
- El estado sigue en la URL (`?city=…&occasion=…`) para poder compartir enlaces.

### 6. Chips de sugerencias personalizadas
- Server: si hay sesión, leer `user_preferences` (estilos) y `users.home_city_id`; construir hasta ~6 chips (ciudad + estilos). Sin sesión u onboarding omitido: las etiquetas de estilo/ocasión más frecuentes en contenido publicado.
- Fila de chips sobre la grilla (scroll horizontal en móvil), con estado activo igual que los filtros. Sin cambio en el ranking.

### 7. Búsqueda con pestañas
- Agregar pestaña **Todo** (por defecto con `?q=`): mezcla resultados de `search_garments` y `search_posts` ordenados por el orden elegido; Marcas y Prendas/Outfits siguen como hoy.
- Los enlaces de pestaña conservan filtros y orden.
- Contadores de pestañas sin consultas duplicadas innecesarias (reusar los conteos para la pestaña activa).
- Corregir el placeholder ("Buscar prendas, outfits, marcas…").

### 8. Pulido de tarjetas
- Mostrar **nombres** de etiquetas en vez de slugs ("Clásico", no "clasico"): mapear slug → nombre en el servidor con los tags que la página ya consulta.
- Evitar saltos de layout: usar dimensiones guardadas si existen; si no, proporción fija (`aspect-[4/5]`, `object-cover`) para posts y prendas.
- Unificar el estilo de `PostCard` y `GarmentCard` (marca, ciudad, precio, insignia de verificada) y distinguir el tipo con una marca sutil (p. ej. "Outfit" / "Prenda").
- Mantener el ♡ (`SaveButton`) en ambas.

### 9. Estados de carga, vacío y error
- `src/app/feed/loading.tsx` con esqueletos de tarjetas; estado pendiente al aplicar filtros (`useTransition`) para que la UI responda al instante.
- Estado vacío con texto útil y botón **"Limpiar filtros"**.
- Errores con copy amigable en español; nunca mostrar `error.message` crudo al usuario (registrar en el servidor).

### 10. Despublicar marcas de muestra (nube)
- Migración reversible (por slug, confirmados en el grupo 1): dejar las 3 marcas en `status = 'pending'` con `submitted_at` nulo, para que salgan del feed y de la búsqueda y **no aparezcan en la cola de aprobación**. Restaurar = volver a `status = 'active'`.
- No se borra nada. Aplicar solo con confirmación explícita en ese momento, y antes de mergear el código.
- Verificar que el feed sigue mostrando contenido de las marcas reales.

### 11. QA y regresión
- `npm run lint` y `next build` limpios.
- Producción local (`next build` + `next start`) contra Supabase local con datos de muestra: mezcla correcta, orden, cada filtro, chips activos, sugerencias (con y sin sesión), scroll infinito (más de 24 elementos), pestañas de búsqueda, estados vacío/error.
- Prueba en móvil real: panel de filtros, chips con scroll, scroll infinito.
- Regresión: marca pendiente no aparece en feed ni búsqueda; `/marca/[slug]`, `/prenda/[id]`, `/post/[id]`, `/saved`, `/admin` siguen respondiendo igual.
- Actualizar `TODO.md` (paginación del feed → hecho) y `HANDOFF.md` si cambia algo del flujo.

**Nota de QA (grupo 11, 2026-09-21):** `chromium-cli` no está disponible en esta sesión, así que el
pase fue por `curl` contra `next build` + `next start` en producción local (Supabase local, tras
`supabase db reset` + `npm run db:import`), no un clic-a-clic real en navegador:
- `/feed`: mezcla posts+prendas OK (marcas "Outfit"/"Prenda" presentes), panel `Sheet` de filtros
  presente en el HTML.
- `/feed?q=vestido`: las 4 pestañas (Todo/Prendas/Outfits/Marcas) presentes.
- `/feed?occasion=formal`: filtro aplica.
- `/feed?city=medellin&occasion=formal` (combinación sin resultados): estado vacío correcto
  ("No hay outfits ni prendas con esos filtros" + botón "Limpiar todo").
- `/api/feed`: responde JSON con `kind`/`score`/tags esperados.
- Regresión: `/`, `/login`, `/marca/bruma`, `/post/[id]`, `/prenda/[id]` → 200; `/saved`, `/admin`
  → 307 (redirigen a login, sin sesión — esperado, no es regresión).
- **Sin cubrir, pendiente de un pase manual real:** interacción de clic (abrir/cerrar `Sheet`,
  chips removibles, chips de sugerencia), scroll infinito con más de 24 elementos (solo hay 9 en
  la muestra local), viewport móvil, sesión con preferencias de onboarding (chips personalizados).

## Preguntas abiertas
1. **Ocasión/Estilo con prendas:** ¿la prenda coincide si aparece en un post con esa etiqueta (propuesta), o las prendas se ocultan cuando hay un filtro de ocasión/estilo activo?
2. **Proporción de la mezcla:** con un solo `score`, si los posts acumulan más popularidad las prendas podrían quedar abajo. ¿Se acepta al inicio, o se fija un patrón (p. ej. 1 prenda cada 3 outfits)?
3. **Etiquetas populares para visitantes:** ¿calculadas desde el contenido publicado (propuesta) o una lista fija curada por el equipo?
4. **Nomenclatura:** ¿"Outfits"/"Prendas" o "Looks"/"Items" en la UI?
