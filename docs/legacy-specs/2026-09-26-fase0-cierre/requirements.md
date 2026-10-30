# Requirements — Cierre de la Fase 0

> El piloto ya corrió con marcas reales y la usabilidad se probó con el equipo. Este spec junta lo
> que quedaba abierto de la Fase 0 (`specs/roadmap.md`) para cerrarla: un bug de links rotos y los
> pendientes de infraestructura del spec `2026-09-19-fase0-social-infra` que no se habían construido.

## Decisiones (confirmadas con producto, 2026-09-26)

| Tema | Decisión |
|---|---|
| Links rotos | Normalizar al guardar **y** al renderizar. Limpiar en la nube los valores ya guardados mal. |
| Google login | Ya está activo en la nube: no se toca. |
| Feedback dentro de la app | **En pausa.** No se construye ahora. |
| Cuota: modelo | **Suma** del peso de las imágenes de la marca (no un contador): se mantiene correcta al borrar o reemplazar. |
| Cuota: staff | Lo que sube el staff en nombre de una marca **cuenta** para su uso, pero **nunca se bloquea**. |
| Cuota: usuarios | 50 MB por usuario se agrega en la Fase 1: hoy los usuarios no suben imágenes. |

## 1. Links rotos (bug)

- Si una marca escribía su Instagram como URL (`https://www.instagram.com/marca/`) o como `@marca`,
  `/marca/[slug]` armaba `https://instagram.com/https://www.instagram.com/marca/`.
- Los links de tienda y de producto del panel de marca y de `/admin` se guardaban tal cual: un
  `tienda.com` sin esquema quedaba como link relativo, y un `https://https://…` quedaba roto.
- **Solución:** `src/lib/links.ts` (`normalizeUrl`, `normalizeInstagramHandle`, `instagramUrl`).
  Se usa al guardar (panel, `/admin`, carga masiva, registro) y al renderizar (`/marca/[slug]`,
  cola de aprobación, redirección `/out/[garmentId]`). Un valor que no se puede normalizar se
  rechaza con un mensaje en español. Migración `20260926000000_normalize_brand_instagram.sql`.

## 2. Páginas 404

- `not-found.tsx` en `/marca/[slug]`, `/prenda/[id]`, `/post/[id]` y uno general en la raíz, con
  el mismo estilo glass y un botón "Volver al feed" (`src/components/not-found-view.tsx`).

## 3. Errores de login y registro en español

- `src/lib/auth-errors.ts` traduce los errores de Supabase Auth (por `code`, con respaldo por
  texto): contraseña incorrecta, correo ya registrado, contraseña corta, correo inválido,
  demasiados intentos, correo sin confirmar.
- Con "Confirm email" activo, un correo repetido no devuelve error (Supabase no revela qué correos
  existen) y el registro no trae sesión: se detectan los dos casos y se muestra el mensaje o el
  aviso "Te enviamos un correo para confirmar tu cuenta" en `/login`.

## 4. Cuota de almacenamiento (300 MB por marca)

- `garment_images.bytes`, `post_images.bytes`, `brands.logo_bytes`: peso del WebP ya redimensionado.
- `check_storage_quota(p_brand_id, p_bytes)` → `{ allowed, used_bytes, limit_bytes }`; solo la
  marca dueña o staff pueden llamarla. Migración `20260926010000_storage_quota.sql`.
- La subida (`src/lib/upload.ts`) revisa la cuota **después** de redimensionar y **antes** de
  escribir en R2. Si no hay espacio: mensaje en español y no queda un registro a medias (se borra
  la prenda/post recién creado).
- Barra de uso en el Resumen del panel de marca: honey desde el 80 %, coral al llegar al límite.
- Las imágenes previas quedan en 0 bytes hasta correr `npm run db:backfill-image-bytes`.

## 5. Instagram: renovación del token y reconexión

- El token de larga duración (~60 días) se renueva al usarlo si le queda menos de una semana.
- Si venció o la marca revocó el acceso desde Instagram, el panel y `/marca/panel/import`
  muestran "Reconectar Instagram" en vez de un error crudo.

## Fuera de alcance

- Feedback dentro de la app (en pausa por decisión de producto).
- Cuota por usuario (Fase 1).
- Sacar el `access_token` de Instagram del alcance de lectura del cliente: hoy la policy de
  `brand_instagram_connections` deja que la marca dueña lea su propio token. Queda anotado en `TODO.md`.
