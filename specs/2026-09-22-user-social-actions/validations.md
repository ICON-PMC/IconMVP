# Validations — Fase 0: Flujo de usuario (guardar · seguir · like)

> Cómo saber que la implementación funciona y se puede mergear.
> Todos los checks deben estar marcados o diferidos con una nota escrita antes de
> mergear `feat/fase0-social-infra` → `main`.

---

## Grupo 1 — Esquema

- [ ] La migración aplica desde cero: `supabase db reset` termina sin errores.
- [ ] `brand_follows(user_id, brand_id)` tiene PK compuesta; los FK cascadean al borrar
      usuario o marca.
- [ ] `post_likes(user_id, post_id)` tiene PK compuesta; los FK cascadean al borrar usuario
      o post.
- [ ] Ambas tablas tienen RLS habilitado **y** GRANT explícito a `authenticated`
      (constitución §7.2).
- [ ] Una usuaria **no** puede insertar/borrar filas a nombre de otra (RLS lo bloquea).
- [ ] `post_feed` incluye `like_count` y conserva todos los campos previos; el feed sigue
      cargando.
- [ ] `post_feed.like_count` refleja el número real de filas en `post_likes` para un post.
- [ ] `posts.popularity` **no** cambia al dar/quitar like (decisión 6).
- [ ] `brands` **no** tiene `follower_count` ni trigger de conteo (decisión 7).
- [ ] `database.types.ts` actualizado: `brand_follows`, `post_likes` y `like_count` en
      `post_feed` (constitución §7.4).
- [ ] `src/lib/social.ts` exporta `getMyFollowedBrandIds`, `getMyLikedPostIds` y
      `getMyFollowedBrands`; devuelven vacío para usuaria anónima.

---

## Grupo 2 — Seguir marcas

- [ ] El botón "Seguir" aparece en `/marca/[slug]` para usuarias logueadas.
- [ ] Al hacer clic, el botón cambia a "Siguiendo" **al instante** (optimistic) y persiste
      tras recargar.
- [ ] Al hacer clic en "Siguiendo", se deja de seguir al instante y persiste tras recargar.
- [ ] Si el server action falla, el botón revierte al estado anterior.
- [ ] Doble clic rápido no crea filas duplicadas (PK compuesta).
- [ ] Una usuaria anónima ve el botón como enlace a `/login?next=/marca/[slug]`.
- [ ] El server action rechaza peticiones sin sesión (devuelve error, no 500).
- [ ] **No** se muestra contador de seguidores en la página de marca (decisión 7).
- [ ] Seguir una marca **no** cambia el orden ni el contenido del feed.

---

## Grupo 3 — Like a posts

- [ ] El corazón aparece en las tarjetas del feed (`PostCard`) y en `/post/[id]`.
- [ ] Al hacer clic, el corazón se rellena al instante (optimistic) y persiste tras recargar.
- [ ] Al hacer clic de nuevo, se quita el like al instante y persiste tras recargar.
- [ ] El contador de likes sube/baja correctamente y coincide con `post_feed.like_count`.
- [ ] El contador de likes es **visible sin login** (decisión 8).
- [ ] Una usuaria anónima que hace clic en el corazón va a `/login?next=<ruta actual>`.
- [ ] Si el server action falla, el corazón y el contador revierten.
- [ ] El server action rechaza peticiones sin sesión (devuelve error, no 500).
- [ ] Dar like **no** modifica `posts.popularity` (verificar por query directa).

---

## Grupo 4 — Página `/saved` con tabs

- [ ] `/saved` sin sesión redirige a `/login?next=/saved`.
- [ ] La página muestra dos tabs: **Guardados** y **Siguiendo**.
- [ ] El tab por defecto es **Guardados**.
- [ ] El tab activo se refleja en la URL (`?tab=guardados` / `?tab=siguiendo`) y es
      enlazable/recargable.
- [ ] El tab **Guardados** muestra posts guardados **y** prendas guardadas (sin regresión).
- [ ] El tab **Siguiendo** lista las marcas seguidas, cada una enlaza a `/marca/[slug]`.
- [ ] Estado vacío de Guardados: "Aún no has guardado nada. Toca el ♡ en un look o una prenda."
- [ ] Estado vacío de Siguiendo: "Aún no sigues ninguna marca."
- [ ] `SiteHeader` mantiene el enlace "Guardados" → `/saved`.

---

## Grupo 5 — Verificación de "guardar" existente

- [ ] `saved_posts` / `saved_garments` siguen funcionando tras los cambios del Grupo 4.
- [ ] `SaveButton` sigue guardando/quitando posts y prendas correctamente.
- [ ] Guardar y dar like sobre el **mismo post** coexisten sin interferirse (independientes).
- [ ] El tab Guardados no perdió ninguna funcionalidad previa de `/saved`.

---

## Casos borde

- [ ] Like y guardar sobre el mismo post: ambos estados persisten de forma independiente.
- [ ] Unfollow / unlike cuando la fila no existía: no es error; el estado final es correcto.
- [ ] Acción sobre un id inexistente: el server action no revienta; el UI revierte.
- [ ] Post archivado / marca inactiva no aparece en `/saved` (la vista filtra `published`).
- [ ] Ninguna interacción de seguir/like produce un 500 en el servidor.

---

## Regresión

- [ ] `npm run build` pasa con cero errores de TypeScript.
- [ ] `npm run lint` pasa.
- [ ] El feed carga; `post_feed` devuelve `like_count` sin romper campos existentes.
- [ ] `/post/[id]`, `/marca/[slug]`, `/prenda/[id]` renderizan sin errores.
- [ ] Las rutas de admin y la carga masiva siguen funcionando.
- [ ] Los tokens glass/tropical siguen intactos (`--color-forest` presente en `globals.css`).
- [ ] Para usuarias anónimas, seguir/like no aparecen como elementos interactivos (son
      enlaces a `/login`).

---

## Criterio de merge

- [ ] Todos los checkboxes de arriba están marcados o diferidos con una nota escrita.
- [ ] La migración está aplicada en Supabase cloud **antes** de mergear el código
      (constitución §7.5).
- [ ] `database.types.ts` reconciliado con `origin/dev` (conflicto esperado; resolver a mano).
- [ ] No queda ningún `TODO` sin un follow-up enlazado en los specs o el roadmap.
- [ ] Las decisiones 6 (like no afecta el feed) y 7 (sin contador de seguidores) se respetan
      en el código final.
