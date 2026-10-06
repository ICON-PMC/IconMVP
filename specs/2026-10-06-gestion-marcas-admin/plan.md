# Plan — Gestión completa para marcas y admin

> Grupos ordenados por dependencia. El **Grupo 1 (base y helpers)** bloquea a los demás.
> Los Grupos 2–5 son independientes entre sí salvo lo indicado. El **Grupo 6** es verificación.
>
> Migraciones a la nube **antes** de mergear el código que las usa; `database.types.ts` en el mismo
> commit (constitución §7.4). Las migraciones se escriben para pegarse en el SQL Editor (sin tablas
> temporales entre statements: ver el spec anterior).

---

## Grupo 1 — Base y helpers (bloquea a todos) ✅ (local, 2026-10-06)

Migraciones (aplicar en este orden en la nube):
1. `20261006060000_admin_users.sql` — `is_admin`, `admin_list_users`, `set_user_role` y el trigger
   de rol ajustado.
2. `20261006070000_close_brand_delete_account.sql` — `_delete_brand` (interna), `close_brand`,
   `delete_my_account` (1c + 1e en un solo archivo: `delete_my_account` reusa el borrado de marca).

Hallazgo al escribir 1b: un **curator podía ponerse `admin`** con un PATCH directo a `users` (el
trigger no limitaba el rol si quien edita es staff y `users_update_own` deja editar la fila propia).
Ahora un cambio de rol solo pasa por `set_user_role`/`_delete_brand` (marcan `icon.role_change`),
por el `user → brand` del registro o sin usuario autenticado (SQL directo).

- **1a. `deleteFromR2(keys)`** en `src/lib/r2.ts`: `DELETE` firmado igual que `uploadToR2`, varios
  keys en paralelo, nunca lanza (devuelve los que fallaron y los registra con `console.error`).
  Helper `imageKeysFor(supabase, { garmentIds?, postIds?, brandId? })` en `src/lib/image-keys.ts`
  (no en `images.ts`, que lo importan componentes de cliente) que lee las claves **antes** de borrar
  filas (después ya no existen).

- **1b. Migración `…_admin_users.sql`**
  - `admin_list_users(q text default null)` → `(id, email, display_name, role, brand_id,
    brand_name, created_at)`; `security definer`, exige `is_staff()`.
  - `set_user_role(p_user_id uuid, p_role user_role)`; `security definer`, exige rol `admin`;
    rechaza el propio usuario y dejar 0 admins. Mensajes en español.
  - `protect_user_role_field`: el cambio de rol pasa a requerir `admin` (hoy basta `is_staff()`),
    salvo el `user → brand` del registro. Revisar que el registro de marca siga funcionando.
  - `revoke execute … from public, anon`; `grant execute … to authenticated`.

- **1c. Migración `…_close_brand.sql`**
  - `close_brand(p_brand_id uuid)` → `void`; `security definer`; exige dueño (`is_brand_owner`) o
    staff. Borra la marca (la cascada se lleva prendas, looks, tags, follows, conexión de
    Instagram) y, si el dueño tenía `role = 'brand'`, lo pasa a `'user'`. `outbound_clicks` queda
    con `brand_id = null` (ya es `on delete set null`).
  - Las imágenes de R2 las borra la server action (1a) con las claves leídas antes de llamar la RPC.

- **1d. Marca activa del panel** en `src/lib/auth.ts` — hecho: `requireBrandOwner()` devuelve
  `{ profile, brand, actingAsStaff }`, `quotaBrandId(ctx)` y `MANAGED_BRAND_COOKIE`. En
  `marca/panel/actions.ts`, `ownPostOrNull` / `ownGarmentIds` filtran por la marca del panel en todas
  las acciones de looks (etiquetar, tallas, quitar, tags, publicar, despublicar).
  - `requireBrandOwner()` pasa a devolver también `actingAsStaff: boolean`: si el usuario es staff y
    existe la cookie `icon_admin_brand` (httpOnly, `sameSite=lax`, sin `maxAge` → de sesión) con un
    id de marca válido, devuelve esa marca. Para cualquier otro usuario, la cookie se ignora.
  - `enforceQuotaFor`: cuando `actingAsStaff`, no bloquear (se sigue contando el peso).
  - Revisar los 17 usos de `requireBrandOwner`: las acciones que hoy no filtran por marca
    (`tagGarmentOnPost`, `setPostTags`, `untagGarmentFromPost`…) dependen de la RLS; con staff la
    RLS deja todo, así que agregar el filtro `author_brand_id = brand.id` / `brand_id = brand.id`
    para no tocar contenido de otra marca por un id equivocado.

- **1e. Migración `…_delete_my_account.sql`**
  - `delete_my_account()` → `void`; `security definer` (dueño `postgres`, que puede borrar en
    `auth.users`); borra `auth.users where id = auth.uid()`. Si es dueño de una marca, la borra antes
    con la misma lógica de `close_brand`. Rechaza si es el último admin.
  - Así la app no necesita la service role key en el servidor.

- **1f. Bug del registro** (`src/app/auth/actions.ts`, `/signup`, `/login`)
  - `SubmitButton` en los dos formularios (hoy son `<button>` simples).
  - `signUp`: ante `user_already_exists`/`email_exists` (o `identities` vacío), probar
    `signInWithPassword`; si entra, seguir como un registro exitoso.
  - Reproducción: doble clic en "Crear cuenta" en Chrome headless (local, confirmaciones apagadas
    como en la nube) → hoy muestra el error con la cuenta creada.

- **1g. `database.types.ts`**: las funciones nuevas.

## Grupo 2 — Prendas (depende de 1a, 1d)

- **2a. `updateBrandGarment(garmentId, formData)`**: campos de la prenda + categoría + tallas +
  estilo/ocasión/clima (`replaceGarmentTags`) + foto opcional. Normaliza el link igual que al crear.
- **2b. Foto**: si llega archivo, `uploadImageField` (cuota) → `garment_images` posición 0
  (update o insert) → `deleteFromR2(vieja)`.
- **2c. UI**: `garment-tags-sheet.tsx` → `edit-garment-sheet.tsx` con el formulario completo
  (reutilizar los campos de `new-garment-form.tsx` en un componente `GarmentFields` con
  `defaultValues`). Texto del botón en la tarjeta: "Editar".
- **2d. Borrado**: `deleteGarments` y `/admin/bulk` `deleteGarmentAction`/`deleteAllPendingAction`
  borran las imágenes de R2 (1a).

## Grupo 3 — Looks (depende de 1a, 1d)

- **3a. Nuevo look**: botón "Nuevo look" en `looks-tab.tsx` (junto a "Importar de Instagram"),
  hoja con foto + caption → `createBrandPost` (ya existe) → redirige al editor.
- **3b. Editor** (`/marca/panel/post/[id]`): caption editable (`updatePostCaption`), cambiar foto
  (`replacePostImage`, misma lógica que 2b), y acciones según estado:
  - borrador: Publicar · Eliminar
  - publicado: Despublicar · Archivar
  - archivado: Restaurar (→ borrador) · Eliminar
- **3c. `archivePost` / `restorePost` / `deletePost`**: filtran por la marca (1d); `deletePost`
  solo si el estado es `draft` o `archived` (validar en el servidor); borra imagen de R2.
- **3d.** `LooksTab` muestra el estado archivado y un filtro Todos/Publicados/Borradores/Archivados
  (igual que el catálogo).

## Grupo 4 — Perfil de marca (depende de 1a, 1c, 1d)

- **4a. Portada** en `profile-tab.tsx`: campo de imagen con vista previa; `updateBrandCover`
  reutiliza la lógica de `saveBrandCover` del onboarding (moverla a `src/lib/brand-cover.ts`) y
  borra la anterior de R2.
- **4b. Cerrar cuenta**: sección "Zona de peligro" con `ConfirmDialog` que exige escribir el nombre.
  `closeBrandAccount(confirmName)`: valida el nombre en el servidor → lee claves de imágenes →
  `close_brand` → `deleteFromR2` → limpia la cookie de staff si aplica → `redirect("/feed?ok=cuenta-cerrada")`.
  Si lo hace el staff, redirige a `/admin?tab=marcas-todas`.

## Grupo 5 — `/admin`: marcas y usuarios (depende de 1b, 1c, 1d)

- **5a. Pestaña "Marcas"** (la actual pasa a llamarse "Pendientes"): tabla/lista responsive con
  búsqueda y filtro por estado (en el cliente: son pocas marcas). Interruptores Activa / Verificada /
  Sostenible → `setBrandFlags(brandId, flags)`. Revisar `brands_protect_curation_fields` (permite al
  staff). Botones **Gestionar** y **Eliminar**.
- **5b. Gestionar**: `startManagingBrand(brandId)` (staff) pone la cookie y redirige a
  `/marca/panel`; `stopManagingBrand()` la borra y vuelve a `/admin?tab=marcas`. Aviso fijo en el
  panel (`ManagingBanner`) cuando `actingAsStaff`. El link "Mi marca" del header no cambia.
- **5c. Eliminar marca** desde la lista: misma acción que 4b (`closeBrandAccount` acepta `brandId`
  cuando es staff).
- **5d. Pestaña "Usuarios"**: lista con `admin_list_users`, búsqueda (`?q=`), select de rol por fila
  solo para admin (`setUserRole` → RPC); curator ve el rol como texto. El propio usuario sin select.

## Grupo 5b — Borrar mi cuenta (depende de 1a, 1e)

- `/settings` → zona de peligro con `ConfirmDialog` que pide "ELIMINAR". `deleteMyAccount(confirm)`:
  valida → si tiene marca, lee las claves de sus imágenes → `delete_my_account` → `deleteFromR2` →
  `signOut` → `redirect("/?ok=cuenta-eliminada")`.

## Grupo 6 — Verificación

Ver `validations.md`. `tsc`, `lint`, `next build`; `supabase db reset`; SQL de las RPC con usuarios
de prueba (dueño, otra marca, curator, admin); recorrido en Chrome headless (390 px) de los flujos
de marca y de admin. Las subidas con foto se prueban en la nube (en local no hay R2).
