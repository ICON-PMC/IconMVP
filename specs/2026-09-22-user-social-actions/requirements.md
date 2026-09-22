# Requirements — Fase 0: Flujo de usuario (guardar · seguir · like)

> Subconjunto del "Flujo de usuario" de la Fase 0 (`specs/roadmap.md`): guardar (favoritos),
> seguir marcas y dar like a posts, más una página donde la usuaria ve lo suyo.
> Este spec **no** cubre infraestructura (shadcn, cuotas R2, 404, errores en español) —
> eso vive en `specs/2026-09-19-fase0-social-infra/`.

---

## 1. Alcance

| Ítem del roadmap | Estado en este branch | Nota |
|---|---|---|
| Guardar (favoritos) posts y productos | **Ya implementado** | `saved_posts` / `saved_garments` + `/saved` + `SaveButton` existen desde `20260614120000_init.sql`. Aquí solo se documenta y valida. |
| Seguir marcas | **Nuevo** | Tabla `brand_follows` + botón en `/marca/[slug]`. |
| Dar like a posts | **Nuevo** | Tabla `post_likes` + botón en feed y detalle. |
| Página "mis guardados" / "siguiendo" | **Nuevo** | `/saved` pasa a tener dos tabs. |

**No incluye:** seguir usuarios (Fase 1), like a prendas, contador de seguidores visible,
notificaciones, feed personalizado, ni que seguir/like alteren el orden del feed.

---

## 2. Relación con `2026-09-19-fase0-social-infra`

Ese spec cubre **todo** lo que quedaba de Fase 0 (seguir, like, cuotas, shadcn, 404, errores).
Este spec es el **subconjunto enfocado en el flujo de usuario** y manda sobre él para:

- `brand_follows` y `post_likes` (esquema + UI).
- La página de "mis guardados / siguiendo".

El spec viejo sigue siendo la referencia para infraestructura. Donde ambos se solapen
(esquema de follows/likes), **este documento es la fuente de verdad**; el viejo se considera
parcialmente superseded en esos grupos.

---

## 3. Decisiones de scope

Estas decisiones se tomaron explícitamente antes de escribir el plan. No se reabren sin
una nota nueva en este archivo.

| # | Decisión | Elección | Por qué |
|---|---|---|---|
| 1 | Relación con el spec de infra | **Subconjunto** del flujo de usuario; el viejo queda para infra | Evita duplicar y mantiene cada spec con un objetivo claro |
| 2 | ¿Rehacer "guardar"? | **No** — ya está hecho; solo documentar y validar | `saved_posts`/`saved_garments` + `/saved` + `SaveButton` ya funcionan |
| 3 | Página de lo guardado/seguido | **Una sola `/saved` con dos tabs** (Guardados \| Siguiendo) | Un solo destino en el header; menos rutas nuevas |
| 4 | ¿Seguir usuarios? | **No** — solo marcas en esta fase | Seguir usuarios es Fase 1 (`roadmap.md`) |
| 5 | ¿Like a prendas? | **No** — solo posts | El roadmap dice "dar like a posts" |
| 6 | ¿El like afecta el feed? | **No** — solo contador visible | Coherente con "seguir no afecta el feed todavía"; el orden es de una fase posterior |
| 7 | Contador de seguidores | **No** se muestra en esta fase | Solo el botón Seguir/Siguiendo; el contador llega con el feed personalizado |
| 8 | Contador de likes | **Público** (visible sin login) | La señal social es pública; solo la acción requiere sesión |
| 9 | Interacción | **Optimistic UI** (client component con rollback) | La interacción debe sentirse instantánea |
| 10 | Dónde va el like | **Feed (`PostCard`) y `/post/[id]`** | Es la señal principal de engagement del post |
| 11 | Contenido del tab Guardados | **Posts + prendas** (lo que ya existe) | No perder funcionalidad actual de `/saved` |

### Decisiones ya dadas por el usuario (contexto original)

- **Guardar y dar like son independientes.** Un usuario puede hacer una, la otra, ambas o
  ninguna sobre el mismo post. No hay exclusión mutua ni estado combinado.
- **Seguir una marca solo guarda la relación en la base de datos.** No debe afectar el feed
  ni el orden todavía — eso es de una fase posterior.
- **Sí se necesita una página** donde la usuaria vea lo guardado y las marcas que sigue.

---

## 4. Contrato de esquema

### 4.1 `brand_follows` (nueva)

```
brand_follows
  user_id     uuid not null references users (id) on delete cascade
  brand_id    uuid not null references brands (id) on delete cascade
  created_at  timestamptz not null default now()
  primary key (user_id, brand_id)
```

- Índice en `brand_id` (para "quién sigue esta marca" y conteos futuros).
- **RLS:** `for all to authenticated using (user_id = current_user_id()) with check (...)`.
- **GRANT:** `insert, delete on brand_follows to authenticated` (el `select` base ya lo da el
  grant global de `init.sql`).
- **Sin** `brands.follower_count` y **sin** trigger de conteo en esta fase (decisión 7).

### 4.2 `post_likes` (nueva)

```
post_likes
  user_id     uuid not null references users (id) on delete cascade
  post_id     uuid not null references posts (id) on delete cascade
  created_at  timestamptz not null default now()
  primary key (user_id, post_id)
```

- Índice en `post_id`.
- **RLS:** igual patrón que `saved_posts` (cada usuaria gestiona lo suyo).
- **GRANT:** `insert, delete on post_likes to authenticated`.
- **Sin** trigger de `popularity` (decisión 6). El like **no** modifica `posts.popularity`.

### 4.3 `post_feed` (vista existente)

- Añadir `like_count` (subconsulta `count(*) from post_likes where post_id = p.id`) para que
  las tarjetas muestren el contador sin una segunda query.
- No se toca `score` ni `popularity`.

### 4.4 `database.types.ts`

- Actualizar a mano (regla de la constitución §7.4): nuevas tablas `brand_follows`,
  `post_likes` y el nuevo campo `like_count` en el row type de `post_feed`.

---

## 5. User stories

### 5.1 Seguir una marca

- Una usuaria logueada ve un botón **"Seguir"** en `/marca/[slug]`.
- Al hacer clic, el botón cambia a **"Siguiendo"** al instante (optimistic) y se crea la fila
  en `brand_follows`.
- Al hacer clic en "Siguiendo", se deja de seguir (se borra la fila) y el botón vuelve a
  "Seguir", también al instante.
- Si la acción falla, el botón revierte al estado anterior.
- Una usuaria anónima ve el botón como enlace a `/login?next=/marca/[slug]`.
- **No** se muestra contador de seguidores (decisión 7).
- Seguir **no** cambia el feed ni el orden de nada (decisión de scope).

### 5.2 Dar like a un post

- Una usuaria logueada ve un corazón en las tarjetas del feed y en `/post/[id]`.
- Al hacer clic, el corazón se rellena al instante (optimistic) y se crea la fila en
  `post_likes`; el contador sube.
- Al hacer clic de nuevo, se quita el like y el contador baja.
- Si la acción falla, el corazón y el contador revierten.
- El **contador de likes es visible sin login**; solo la acción requiere sesión.
- Una usuaria anónima que hace clic en el corazón va a `/login?next=<ruta actual>`.
- El like **no** altera `posts.popularity` ni el orden del feed (decisión 6).

### 5.3 Mis guardados / Siguiendo

- `/saved` requiere sesión; sin sesión redirige a `/login?next=/saved`.
- La página tiene **dos tabs**: **Guardados** y **Siguiendo**.
- **Guardados** muestra los posts guardados y las prendas guardadas (lo que ya existía).
- **Siguiendo** muestra las marcas que la usuaria sigue, con enlace a `/marca/[slug]`.
- Cada tab tiene su estado vacío en español:
  - Guardados: "Aún no has guardado nada. Toca el ♡ en un look o una prenda."
  - Siguiendo: "Aún no sigues ninguna marca."
- El header (`SiteHeader`) mantiene el enlace "Guardados" apuntando a `/saved`.

---

## 6. Casos borde

| Caso | Comportamiento esperado |
|---|---|
| Doble clic rápido en Seguir/Like | El optimistic UI evita duplicados; la PK compuesta impide filas repetidas |
| Like y guardar sobre el mismo post | Independientes: ambos pueden coexistir (decisión de scope) |
| Unfollow / unlike cuando no existía la fila | No es error; el estado final es "no sigue / no like" |
| Acción sin sesión | Redirige a `/login?next=<ruta>`; nunca 500 |
| Acción sobre un id inexistente | El server action no revienta; devuelve error y el UI revierte |
| Post archivado / marca inactiva | No aparece en `/saved` (la vista `post_feed` ya filtra `published`) |
| Usuaria intenta seguir/likear a nombre de otra | RLS lo bloquea (policy `user_id = current_user_id()`) |

---

## 7. Restricciones de diseño

- **Tokens glass/tropical:** todo usa `--color-forest/leaf/coral/blush/cream` y `.glass` /
  `.glass-input`. Ningún sistema de color paralelo (constitución §8).
- **Mobile-first:** botones con área táctil mínima de 44px.
- **Copy en español** en toda la UI.
- **Optimistic UI** con rollback en error (decisión 9).
- **RLS + GRANT siempre en par** en cada tabla nueva (constitución §7.2).
- **Migraciones a la nube antes del código** que las usa (constitución §7.5).
