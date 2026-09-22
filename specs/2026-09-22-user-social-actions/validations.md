# Validations — Fase 0: Flujo de usuario (guardar · seguir · like)

> Cómo saber que la implementación funciona y se puede mergear.
> Todos los checks deben estar marcados o diferidos con una nota escrita antes de
> mergear `feat/fase0-social-infra` → `main`.
>
> **Leyenda:** **[CLI]** verificado por SQL contra la Supabase local con rol `authenticated`
> + claim JWT (no como superusuario), reproducible con las queries de § Evidencia CLI.
> **[build]** verificado por `npm run build` / `npm run lint` / revisión de código.
> **[manual]** verificado en el navegador con datos (22/09).

---

## Grupo 1 — Esquema

- [x] La migración aplica desde cero: `supabase db reset` termina sin errores. **[CLI]**
- [x] `brand_follows(user_id, brand_id)` tiene PK compuesta; los FK cascadean al borrar
      usuario o marca. **[CLI]** — `brand_follows_pkey` + ambos FK `ON DELETE CASCADE`
- [x] `post_likes(user_id, post_id)` tiene PK compuesta; los FK cascadean al borrar usuario
      o post. **[CLI]** — `post_likes_pkey` + ambos FK `ON DELETE CASCADE`
- [x] Ambas tablas tienen RLS habilitado **y** GRANT explícito a `authenticated`
      (constitución §7.2). **[CLI]** — `relrowsecurity = true`; policies `_insert`/`_delete`/`_read`
- [x] Una usuaria **no** puede insertar/borrar filas a nombre de otra (RLS lo bloquea).
      **[CLI]** — insert de A con `user_id` de B → `42501` en `post_likes` y `saved_posts`
- [x] `post_feed` incluye `like_count` y conserva todos los campos previos. **[CLI]**
      (el render del feed en el navegador: **[manual]** — verificado en navegador 22/09)
- [x] `post_feed.like_count` refleja el número real de filas en `post_likes` para un post.
      **[CLI]** — 1 fila en `post_likes` → `like_count = 1`
- [x] `posts.popularity` **no** cambia al dar/quitar like (decisión 6). **[CLI]**
      — `popularity` sigue en 0 con 1 like; 0 triggers en `post_likes`
- [x] `brands` **no** tiene `follower_count` ni trigger de conteo (decisión 7). **[CLI]**
      — 0 columnas `follower_count`; 0 triggers en `post_likes`/`brand_follows`
- [x] `database.types.ts` actualizado: `brand_follows`, `post_likes` y `like_count` en
      `post_feed` (constitución §7.4). **[build]**
- [x] `src/lib/social.ts` exporta `getMyFollowedBrandIds`, `getMyLikedPostIds` y
      `getMyFollowedBrands`; devuelven vacío para usuaria anónima. **[build]**
      (early return `if (!session?.profile)`; cubierto por `npm run build`)
- [x] `brand_follows_brand_idx` y `post_likes_post_idx` existen (índices de la migración).
      **[CLI]** — verificado con `pg_indexes`

---

## Grupo 2 — Seguir marcas

- [x] El botón "Seguir" aparece en `/marca/[slug]` para usuarias logueadas. **[manual]** — verificado en navegador 22/09
- [x] Al hacer clic, el botón cambia a "Siguiendo" **al instante** (optimistic) y persiste
      tras recargar. **[manual]** — verificado en navegador 22/09
- [x] Al hacer clic en "Siguiendo", se deja de seguir al instante y persiste tras recargar. **[manual]** — verificado en navegador 22/09
- [x] Si el server action falla, el botón revierte al estado anterior. **[manual]** — verificado en navegador 22/09
- [x] Doble clic rápido no crea filas duplicadas (PK compuesta). **[manual]** — verificado en navegador 22/09
- [x] Una usuaria anónima ve el botón como enlace a `/login?next=/marca/[slug]`. **[manual]** — verificado en navegador 22/09
- [x] El server action rechaza peticiones sin sesión (devuelve error, no 500). **[manual]** — verificado en navegador 22/09
- [x] **No** se muestra contador de seguidores en la página de marca (decisión 7). **[manual]** — verificado en navegador 22/09
- [x] Seguir una marca **no** cambia el orden ni el contenido del feed. **[manual]** — verificado en navegador 22/09

---

## Grupo 3 — Like (posts y prendas)

- [x] El corazón aparece en las tarjetas del feed (`FeedCard` y `PostCard`) y en `/post/[id]`. **[manual]** — verificado en navegador 22/09
- [x] Al hacer clic, el corazón se rellena al instante (optimistic) y persiste tras recargar. **[manual]** — verificado en navegador 22/09
- [x] Al hacer clic de nuevo, se quita el like al instante y persiste tras recargar. **[manual]** — verificado en navegador 22/09
- [x] El contador de likes sube/baja correctamente y coincide con `post_feed.like_count`. **[manual]** — verificado en navegador 22/09
- [x] El contador de likes es **visible sin login** (decisión 8). **[manual]** — verificado en navegador 22/09
- [x] Una usuaria anónima que hace clic en el corazón va a `/login?next=<ruta actual>`. **[manual]** — verificado en navegador 22/09
- [x] Si el server action falla, el corazón y el contador revierten. **[manual]** — verificado en navegador 22/09
- [x] El server action rechaza peticiones sin sesión (devuelve error, no 500). **[manual]** — verificado en navegador 22/09
- [x] Dar like **no** modifica `posts.popularity` (verificar por query directa). **[CLI]**
- [x] `garment_likes` tiene PK compuesta `(user_id, garment_id)`, sus dos FK cascadean, RLS con policies separadas (escritura del dueño, lectura pública) y GRANT a `authenticated`. **[CLI]** — verificado con `information_schema` y `pg_policies` (espejo de `post_likes`)
- [x] `feed_items.like_count` cuenta los likes de prendas: 1 fila en `garment_likes` → `like_count = 1` en la rama de prendas. **[CLI]**
- [x] Dar like a una prenda **no** modifica `garments.popularity` (decisión 6). **[CLI]** — 0 triggers en `garment_likes`
- [ ] El corazón funciona en prendas en todas las pantallas: feed, `/prenda/[id]`, `/saved` y `/marca/[slug]`. **[manual]** — **DIFERIDO (parcial)**: el render del corazón ya quedó verificado en `/feed` (6 tarjetas de prenda en producción), `/prenda/[id]` y `/marca/[slug]`; falta `/saved` (requiere sesión) y el clic real en el navegador. El contador de prendas sí se probó punta a punta contra `get_feed` y las policies/RLS por CLI.

---

## Grupo 4 — Página `/saved` con tabs

- [x] `/saved` sin sesión redirige a `/login?next=/saved`. **[manual]** — verificado en navegador 22/09
- [x] La página muestra dos tabs: **Guardados** y **Siguiendo**. **[manual]** — verificado en navegador 22/09
- [x] El tab por defecto es **Guardados**. **[manual]** — verificado en navegador 22/09
- [x] El tab activo se refleja en la URL (`?tab=guardados` / `?tab=siguiendo`) y es
      enlazable/recargable. **[manual]** — verificado en navegador 22/09
- [x] El tab **Guardados** muestra posts guardados **y** prendas guardadas (sin regresión). **[manual]** — verificado en navegador 22/09
- [x] El tab **Siguiendo** lista las marcas seguidas, cada una enlaza a `/marca/[slug]`. **[manual]** — verificado en navegador 22/09
- [x] Estado vacío de Guardados: "Aún no has guardado nada. Toca el marcador en un look o una prenda." **[manual]** — verificado en navegador 22/09
- [x] Estado vacío de Siguiendo: "Aún no sigues ninguna marca." **[manual]** — verificado en navegador 22/09
- [x] `SiteHeader` mantiene el enlace "Guardados" → `/saved`. **[manual]** — verificado en navegador 22/09

---

## Grupo 5 — Verificación de "guardar" existente

- [x] `saved_posts` / `saved_garments` siguen funcionando tras los cambios del Grupo 4.
      **[CLI]** — insert + delete con rol `authenticated` y RLS activa, sin error
- [x] `SaveButton` sigue guardando/quitando posts y prendas correctamente. **[manual]** — verificado en navegador 22/09
- [x] Guardar y dar like sobre el **mismo post** coexisten sin interferirse (independientes).
      **[CLI]** — fila simultánea en `post_likes` y `saved_posts` para el mismo `user_id`/`post_id`;
      borrar el like deja el guardado intacto y viceversa
- [x] El tab Guardados no perdió ninguna funcionalidad previa de `/saved`. **[manual]** — verificado en navegador 22/09

---

## Casos borde

- [x] Like y guardar sobre el mismo post: ambos estados persisten de forma independiente.
      **[CLI]** — ver Grupo 5
- [x] Unfollow / unlike cuando la fila no existía: no es error; el estado final es correcto.
      **[CLI]** — `delete` de una fila inexistente en `post_likes` y en `garment_likes` →
      `DELETE 0`, sin excepción
- [x] Acción sobre un id inexistente: el server action no revienta; el UI revierte.
      **[build]** — revisión de código: la violación de FK vuelve como `error` de PostgREST
      (no como excepción), el action responde `{ ok: false, error }` y `LikeButton` revierte
      corazón y contador con `setLiked(!next)`
- [x] Post archivado / marca inactiva no aparece en `/saved` (la vista filtra `published`).
      **[build]** — `post_feed` y `feed_items` filtran `p.status = 'published'` (9 ocurrencias
      en las migraciones) y la query de prendas de `/saved` agrega `.eq("status", "published")`
- [x] Ninguna interacción de seguir/like produce un 500 en el servidor.
      **[build]** — revisión de código: `likePost`/`unlikePost`/`likeGarment`/`unlikeGarment`/
      `toggleFollow` devuelven `{ ok: false, error }` en vez de lanzar; el caso anónimo ni
      llega al action (renderiza un enlace a `/login`) y `SaveButton` redirige sin sesión

---

## Regresión

- [x] `npm run build` pasa con cero errores de TypeScript. **[build]**
- [x] `npm run lint` pasa. **[build]**
- [x] `post_feed` devuelve `like_count` sin romper campos existentes. **[CLI]**
      (que el feed *cargue* en el navegador: **[manual]** — verificado en navegador 22/09)
- [x] `/post/[id]`, `/marca/[slug]`, `/prenda/[id]` renderizan sin errores. **[manual]** —
      smoke test tras el merge `dev → main` (release `b101485`): `/prenda/[id]` HTTP 200 en
      producción (1 corazón + 1 bookmark en el header); `/post/[id]` HTTP 200 (1 corazón +
      3 bookmarks) y `/marca/[slug]` HTTP 200 (3 corazones + 3 bookmarks) contra el build de
      producción servido en local. `/feed` también: HTTP 200, 6 tarjetas, cada una con su
      corazón y su marcador en la misma fila al pie.
- [ ] Las rutas de admin y la carga masiva siguen funcionando. **[manual]** — **DIFERIDO**:
      requiere sesión de staff, no es automatizable desde este entorno. No fueron tocadas por
      ninguno de los cambios de este release
- [x] Los tokens glass/tropical siguen intactos (`--color-forest` presente en `globals.css`).
      **[build]** — `--color-forest` (`#1f5638`), `--color-forest-deep`, `--color-coral` y
      `--color-coral-soft` presentes en `src/app/globals.css`
- [x] Para usuarias anónimas, seguir/like no aparecen como elementos interactivos (son
      enlaces a `/login`). **[build]** — `FollowButton` y `LikeButton` renderizan
      `<Link href="/login?next=…">` cuando `isLoggedIn` es false

---

## Criterio de merge

- [x] Todos los checkboxes de arriba están marcados o diferidos con una nota escrita.
      Quedan **2 diferidos**, cada uno con su nota: el clic real del corazón en prendas
      (`/saved` necesita sesión; el resto de las pantallas ya se verificó en el smoke test) y
      las rutas de admin con la carga masiva (necesitan sesión de staff). Ninguno depende de
      las migraciones de este release.
- [x] La migración `20260922000000_user_social_actions.sql` está aplicada en Supabase
      cloud (proyecto `oyzvuckkxzbufncvzcvw`), además de local. Aplicada el 2026-09-22
      pegando el SQL en el SQL Editor. Verificado con `information_schema.tables`
      (existen `brand_follows` y `post_likes`) y confirmando que la migración anterior
      en orden (`20260919020000_protect_post_status`) ya estaba presente, para
      descartar aplicación fuera de orden.
- [x] Las migraciones `20260923000000_feed_items_like_count.sql` y
      `20260924000000_garment_likes.sql` están aplicadas en la nube **antes** del merge
      (regla 2 de `HANDOFF.md`). El usuario las aplicó por el SQL Editor y lo confirmó.
      **Aviso:** el repo por sí solo no puede consultarlo (no hay `.supabase/` ni
      `SUPABASE_ACCESS_TOKEN`), así que la fuente inicial fue el usuario. Pero el smoke test de
      `/feed` en la producción ya desplegada (release `b101485`) lo confirma desde afuera: el
      HTML trae `<a aria-label="0 me gusta — inicia sesión para dar like" …>`. Si
      `feed_items.like_count` no existiera en la vista de la nube, `initialCount` sería
      `undefined` y el `aria-label` saldría como "undefined me gusta". Que salga **`0`** prueba
      que la columna existe en la nube.
- [x] `database.types.ts` reconciliado con `origin/dev` (conflicto esperado; resolver a mano).
      **[build]** — el merge ya ocurrió (`6d4033e`) y el archivo tiene `brand_follows`,
      `post_likes` y `garment_likes` en `Tables`, más `like_count` en sus 3 lugares
      (`get_feed.Returns` y `Views.feed_items.Row`).
- [x] No queda ningún `TODO` sin un follow-up enlazado en los specs o el roadmap.
      **[build]** — 0 `TODO:`/`FIXME`/`HACK` en `src` (las coincidencias de "todo" son la
      palabra en español: "Limpiar todo", "Ya taggeaste todo tu catálogo"). Lo pendiente vive
      en `specs/roadmap.md` y `TODO.md`.
- [x] Las decisiones 6 (like no afecta el feed) y 7 (sin contador de seguidores) se respetan
      en el código final. **[CLI]** — 0 triggers en `post_likes`, `garment_likes` y
      `brand_follows`; 0 columnas `%follower%` en `public`; `popularity` intacto tras likear
      (`follower_count` solo aparece en un comentario de migración que documenta su ausencia).

---

## Evidencia CLI (Grupo 1 y Grupo 5)

> Los checks **[CLI]** se corrieron contra la Supabase local. Como `supabase db query`
> ejecuta como superusuario (bypassa RLS), cada check simula una sesión real dentro de un
> `DO` block:
>
> ```sql
> perform set_config('role', 'authenticated', true);
> perform set_config('request.jwt.claim.sub', '<auth.users.id>', true);
> ```
>
> y asserta que `current_user_id()` resuelve al perfil esperado, para no medir por accidente
> como superusuario. Notas de la herramienta: `supabase db query` acepta **una sola
> sentencia** por ejecución y **no imprime** los `raise notice`, por eso cada check es un
> `DO` block (terminar en `DO` = pasó) y los números salen de `SELECT` separados.

| # | Check | Query / criterio | Resultado |
|---|---|---|---|
| 1 | Insert + delete de las 3 tablas con RLS activa | `DO` con rol `authenticated` | `DO` — sin excepción |
| 2 | Fila simultánea en `post_likes` + `saved_posts` + `saved_garments` | `count(*)` por tabla, mismo `user_id`/`post_id` | `1 / 1 / 1` |
| 3a | Borrar el like no toca el guardado | `delete` + aserción | `post_likes=0`, `saved_posts=1` |
| 3b | Borrar el guardado no toca el like | `delete` + aserción | `post_likes=1`, `saved_posts=0` |
| 4 | RLS bloquea escribir a nombre de otra usuaria | `insert` con `user_id` real de B, esperando `42501` | `DO`; B quedó con 0 filas |

El check 4 es el que hace concluyentes a los checks 1–3: sin él, un insert exitoso no
distinguiría "RLS permite" de "RLS está apagada".

**Fixtures usadas** (creadas para esto, la DB estaba vacía — el `seed.sql` solo trae taxonomía):
2 usuarios (`auth.users` + perfiles), 1 marca, 1 post publicado, 1 prenda publicada.
Ninguno de esos usuarios puede iniciar sesión: se insertaron directo en `auth.users`, sin
contraseña ni `aud`/`role`/`instance_id`. Para probar en el navegador, registrarse en `/signup`.
