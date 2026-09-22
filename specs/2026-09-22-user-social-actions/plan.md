# Plan — Fase 0: Flujo de usuario (guardar · seguir · like)

> Grupos ordenados por dependencia. El **Grupo 1 (esquema)** bloquea a los Grupos 2 y 3.
> El **Grupo 4** depende de los Grupos 1 y 2. El **Grupo 5** es verificación, no construcción.
>
> Contexto: `saved_posts` / `saved_garments` + `/saved` + `SaveButton` **ya existen**.
> Este plan construye lo que falta: `brand_follows`, `post_likes` y la página con tabs.

---

## Grupo 1 — Esquema (bloquea a 2, 3 y 4)
*Empezar aquí. Aplicar la migración a la nube antes de mergear el código que la usa.*

- **1a. Migración `brand_follows`**
  - `user_id uuid not null references users (id) on delete cascade`
  - `brand_id uuid not null references brands (id) on delete cascade`
  - `created_at timestamptz not null default now()`
  - PK compuesta `(user_id, brand_id)`; índice en `brand_id`.
  - `enable row level security` + policy `for all to authenticated` con
    `user_id = (select public.current_user_id())` (mismo patrón que `saved_posts`).
  - `grant insert, delete on brand_follows to authenticated`.
  - **Sin** `brands.follower_count` ni trigger de conteo (decisión 7).

- **1b. Migración `post_likes`**
  - `user_id uuid not null references users (id) on delete cascade`
  - `post_id uuid not null references posts (id) on delete cascade`
  - `created_at timestamptz not null default now()`
  - PK compuesta `(user_id, post_id)`; índice en `post_id`.
  - RLS + GRANT igual que `saved_posts`.
  - **Sin** trigger de `popularity` (decisión 6).

- **1c. `post_feed` gana `like_count`**
  - `create or replace view post_feed ...` añadiendo
    `(select count(*) from post_likes pl where pl.post_id = p.id)::int as like_count`.
  - Mantener `security_invoker = true` y todos los campos existentes.
  - No tocar `score` ni `popularity`.

- **1d. `database.types.ts`**
  - Añadir `brand_follows` y `post_likes` a `Tables`.
  - Añadir `like_count: number` al row type de `post_feed` en `Views`.
  - Actualizar en el mismo commit que la migración (constitución §7.4).

- **1e. Helper de lectura** `src/lib/social.ts` (nuevo)
  - `getMyFollowedBrandIds(): Promise<Set<string>>` — ids de marcas que sigue la usuaria
    actual (vacío si anónima). Mismo patrón que `getMySavedIds()`.
  - `getMyLikedPostIds(): Promise<Set<string>>` — ids de posts con like de la usuaria actual.
  - `getMyFollowedBrands()` — filas de marcas seguidas (id, name, slug, city) para el tab
    "Siguiendo".

---

## Grupo 2 — Seguir marcas (depende del Grupo 1)
*Server actions + botón optimistic + integración en `/marca/[slug]`.*

- **2a. Server actions** en `src/app/marca/[slug]/actions.ts` (nuevo):
  - `followBrand(brandId)` — inserta en `brand_follows`; `revalidatePath`.
  - `unfollowBrand(brandId)` — borra de `brand_follows`; `revalidatePath`.
  - Ambas exigen sesión; sin sesión devuelven error (no 500). Idempotentes ante doble clic.

- **2b. `FollowButton`** `src/components/follow-button.tsx` (nuevo, client component):
  - Props: `brandId`, `initialFollowing: boolean`.
  - Estado local `following`; al clic cambia al instante (optimistic) y llama al action;
    revierte si el action devuelve error.
  - Etiqueta "Seguir" / "Siguiendo"; icono de `lucide-react`.
  - Área táctil ≥ 44px; usa tokens glass/tropical.
  - Anónima: renderiza un enlace a `/login?next=/marca/[slug]`.
  - **Sin** contador de seguidores (decisión 7).

- **2c. Integrar en `/marca/[slug]`**
  - Cargar si la usuaria actual sigue la marca (`getMyFollowedBrandIds()`).
  - Colocar `FollowButton` en la cabecera de marca (`GlassCard`).

---

## Grupo 3 — Like a posts (depende del Grupo 1)
*Server actions + botón optimistic + integración en feed y detalle.*

- **3a. Server actions** en `src/app/post/[id]/actions.ts` (nuevo):
  - `likePost(postId)` / `unlikePost(postId)`.
  - Exigen sesión; sin sesión devuelven error. Idempotentes.

- **3b. `LikeButton`** `src/components/like-button.tsx` (nuevo, client component):
  - Props: `postId`, `initialLiked: boolean`, `initialCount: number`.
  - Optimistic: rellena el corazón y ajusta el contador al instante; revierte en error.
  - Corazón de `lucide-react`; relleno cuando hay like.
  - Contador **visible sin login** (decisión 8); la acción requiere sesión.
  - Anónima: enlace a `/login?next=<ruta actual>`.
  - Área táctil ≥ 44px; tokens glass/tropical.

- **3c. Integrar en `PostCard` y `/post/[id]`**
  - `post_feed` ya trae `like_count` — sin query extra para el contador.
  - Cargar los ids con like de la usuaria actual en una sola query
    (`getMyLikedPostIds()`) y pasarlos a las tarjetas.
  - `PostCard` recibe `liked` y `likeCount`; renderiza `LikeButton`.
  - `/post/[id]` renderiza `LikeButton` junto al `SaveButton` existente.
  - Guardar y like coexisten sin interferirse (decisión de scope).

---

## Grupo 4 — Página `/saved` con tabs (depende de 1 y 2)
*Guardados (posts + prendas) | Siguiendo (marcas).*

- **4a. Tabs en `/saved`**
  - Convertir `/saved` en una página con dos tabs: **Guardados** y **Siguiendo**.
  - Tab por defecto: **Guardados**.
  - El tab activo se controla con `?tab=guardados|siguiendo` (searchParam) para que sea
    enlazable y funcione sin JS.
  - **Guardados:** conserva exactamente lo actual (posts + prendas guardadas).
  - **Siguiendo:** lista de marcas seguidas (`getMyFollowedBrands()`), cada una enlaza a
    `/marca/[slug]`.
  - Estados vacíos en español (ver requirements §5.3).
  - Sin sesión → `redirect("/login?next=/saved")` (ya existe).

- **4b. Header**
  - `SiteHeader` mantiene el enlace "Guardados" → `/saved` (sin cambios de ruta).

---

## Grupo 5 — Verificación de "guardar" existente (sin construcción)
*No se reescribe nada. Solo se confirma y documenta que sigue funcionando.*

- **5a.** Confirmar que `saved_posts` / `saved_garments` + `/saved` + `SaveButton` siguen
  operativos tras los cambios del Grupo 4 (el tab Guardados no debe romperse).
- **5b.** Confirmar que guardar y like son independientes sobre el mismo post.
- **5c.** Anotar en `validations.md` el resultado; si algo se rompe, se arregla dentro del
  Grupo 4, no se reimplementa guardar.

---

## Orden de merge (recomendación)

1. **Grupo 1** primero — el esquema es la base de 2, 3 y 4. Aplicar la migración a Supabase
   cloud **antes** de mergear el código (constitución §7.5).
2. **Grupos 2 y 3** en cualquier orden una vez el Grupo 1 esté en la base.
3. **Grupo 4** después de 1 y 2 (necesita `brand_follows` y el helper de lectura).
4. **Grupo 5** es verificación continua; se cierra antes del merge final.

---

## Notas de coordinación

- Este branch está **detrás de `origin/dev`** (dev ya tiene brand-registration). Antes de
  empezar a construir, hacer rebase/merge de `origin/dev` para evitar conflictos en
  `database.types.ts` y en `SiteHeader`.
- `database.types.ts` es el punto de conflicto más probable con `origin/dev`; reconciliar a
  mano (constitución §7.4).
- El spec `2026-09-19-fase0-social-infra` planeaba `brands.follower_count` y un trigger de
  `popularity` por like. **Este plan los descarta** (decisiones 6 y 7); si ese spec se
  implementa después, debe respetar estas decisiones o abrir una nota nueva.
