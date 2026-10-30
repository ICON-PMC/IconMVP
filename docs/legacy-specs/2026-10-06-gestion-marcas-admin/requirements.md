# Requirements — Gestión completa para marcas y admin

> **Estado (2026-10-06): construido y verificado en local; las migraciones del Grupo 1 están en la
> nube.** Falta mergear `dev` → `main` y probar en producción lo de "Pendiente" al final.

> Auditoría del 2026-10-06: el panel de marca y `/admin` crean contenido, pero casi no lo editan
> ni lo borran. Una marca no puede corregir el precio de una prenda, no puede crear un look sin
> Instagram ni borrar uno, y el staff no tiene una vista para "cargar **y editar** en nombre de una
> marca" como pide el roadmap (Fase 0, flujo de admin).

## Decisiones (confirmadas con producto, 2026-10-06)

| # | Tema | Decisión |
|---|---|---|
| 1 | Editar en nombre de una marca | El staff abre **el mismo panel de la marca** (`/marca/panel`) desde una lista en `/admin`, con un aviso "Estás gestionando X". No se duplican formularios. |
| 2 | Borrar un look | Borrador → se borra de verdad. Publicado → primero **Archivar** (sale del feed, se puede recuperar); archivado → se puede borrar. |
| 3 | Imágenes en R2 | Al borrar o reemplazar una prenda, look o portada, se borra el archivo en R2. Si R2 falla, el cambio en la base se mantiene y el error queda en el log. |
| 4 | Portada | La marca la cambia desde Panel → Perfil (mismas reglas que el registro). |
| 5 | Desactivar marca | El staff activa/desactiva una marca desde `/admin` (`is_active`): se oculta con todo su contenido, sin borrar nada. |
| 6 | Roles | Lista de usuarios en `/admin`. **Solo admin** cambia roles; curator la ve sin editar. Nadie cambia su propio rol y no se puede quitar el último admin. La base se ajusta a "solo admin". |
| 7 | Cerrar cuenta de marca | Borra la marca y todo su contenido (cascada + R2). Las métricas de clics quedan como filas anónimas. La persona sigue con su cuenta como usuario (`role = 'user'`). Hay que escribir el nombre de la marca para confirmar. El staff puede hacer lo mismo desde `/admin`. |
| 8 | Looks sin Instagram | La marca crea un look subiendo una foto y un caption; queda en borrador y sigue el mismo editor que los importados. |
| 9 | Borrar cuenta de usuario | Cualquier usuario borra su cuenta desde `/settings`, **incluido el login en Supabase Auth** (`auth.users`). Si tiene una marca, primero se cierra la marca (decisión 7). Hay que escribir "ELIMINAR" para confirmar. El último admin no puede borrarse. |
| 10 | Bug del registro | Se corrige el "Este correo ya está registrado" que aparece aunque la cuenta sí se creó (sección 7). |

## Estado actual (2026-10-06)

| Entidad | Panel de marca | `/admin` |
|---|---|---|
| Perfil de marca | Edita nombre, bio, tienda, Instagram, ciudad, estilos. **No la portada.** | Solo crear y aprobar/rechazar. **Sin lista, sin editar.** |
| Prendas | Crear; etiquetas; publicar/archivar; borrar. **No edita título, precio, descripción, link, color, tallas ni foto.** | Crear; carga masiva; foto y borrado solo de pendientes. **Sin catálogo general.** |
| Looks | **Solo importando de Instagram** (`createBrandPost` existe sin pantalla). Etiquetas, prendas, publicar. **No edita caption ni foto; no borra.** | Solo crear. **Sin lista.** |
| Usuarios | — | **Nada** (roles por SQL). `users` no tiene policy de lectura para staff. |
| R2 | No hay función para borrar: cada borrado deja el archivo. | — |

## 1. Prendas: edición completa (marca y staff)

- Tocar una prenda del catálogo abre **Editar prenda** (reemplaza la hoja "Etiquetas" del spec
  anterior): título, precio, descripción, link, color, tela, categoría, tallas, estilo/ocasión/clima
  y **cambiar foto**.
- Cambiar la foto: sube la nueva (respeta la cuota), actualiza `garment_images` y borra la vieja de R2.
- Borrar prendas (ya existe) también borra sus imágenes de R2.

## 2. Looks: crear, editar, archivar, borrar

- **Nuevo look** en la pestaña Looks: foto + caption → borrador → editor del look (mismo flujo que
  un importado). Funciona sin Instagram conectado.
- En el editor del look: editar **caption**, **cambiar foto**, **Archivar** (publicado) /
  **Restaurar** (archivado, vuelve a borrador) y **Eliminar** (borrador o archivado), con confirmación.
- Borrar un look borra su imagen de R2. Las prendas etiquetadas no se tocan.

## 3. Perfil: portada y cierre de cuenta

- Panel → Perfil: **Cambiar portada** (imagen, máx. 10 MB, cuota). Borra la anterior de R2.
- Panel → Perfil, al final, zona de peligro: **Cerrar cuenta de marca**. Diálogo que explica qué se
  borra y pide escribir el nombre exacto de la marca. Al terminar redirige a `/feed` con aviso.

## 4. `/admin` → Marcas

- Lista de **todas** las marcas: nombre, ciudad, estado (pendiente/activa/rechazada), activa,
  verificada, sostenible, cantidad de prendas y looks. Búsqueda por nombre y filtro por estado.
- Por marca: interruptores **Activa**, **Verificada**, **Sostenible**; **Gestionar** (abre el panel
  como esa marca); **Eliminar marca** (misma acción que el cierre de cuenta, con confirmación).
- La cola de aprobación actual se mantiene (pestaña "Marcas pendientes").

## 5. Gestionar como marca (staff)

- **Gestionar** guarda la marca elegida en una cookie de sesión y abre `/marca/panel`.
- El panel muestra un aviso fijo "Estás gestionando **X**" con **Salir**.
- Todo lo que hace la marca lo puede hacer el staff (la RLS ya da `staff_all`). Lo que sube el staff
  **cuenta** para la cuota de la marca pero **no se bloquea** (decisión del spec `2026-09-26-fase0-cierre`).
- La cookie solo se respeta si el usuario es staff; para cualquier otro se ignora.

## 6. `/admin` → Usuarios

- Lista de usuarios: correo, nombre, rol, marca vinculada, fecha de alta. Búsqueda por correo/nombre.
- Admin: cambia el rol (`user`, `brand`, `curator`, `admin`). Curator: solo lectura.
- Bloqueos (en la base, no solo en la UI): no cambiar el propio rol; no dejar cero admins.

## 7. Bug: "Este correo ya está registrado" al crear la cuenta

- **Síntoma:** al registrarse aparece "Este correo ya está registrado. Inicia sesión.", pero la
  cuenta sí queda creada en Supabase.
- **Causa (reproducida en local, 2026-10-06):** el botón "Crear cuenta" no se deshabilita mientras
  la server action corre. Un doble toque (frecuente en celular) manda dos `signUp`: el primero crea
  la cuenta (en la nube "Confirm email" está **apagado**: entra directo) y el segundo recibe
  `user_already_exists`; el navegador muestra la respuesta del segundo.
- **Arreglo:**
  - Botón con `SubmitButton` (se deshabilita con `useFormStatus`) en `/signup` y `/login`.
  - En `signUp`, si el error es "ya registrado", intentar `signInWithPassword` con los mismos datos:
    si entra, es su propia cuenta recién creada (o ya tenía una con esa contraseña) y sigue al
    onboarding; si no, se mantiene el mensaje.
- **Dato:** en la nube "Confirm email" está apagado (24/24 cuentas confirmadas, ninguna con correo
  de confirmación enviado). Responde el pendiente del `TODO.md`.

## 8. Borrar mi cuenta (cualquier usuario)

- `/settings`, al final, zona de peligro: **Eliminar mi cuenta**. Explica qué se borra (guardados,
  likes, marcas que sigue, preferencias; y la marca con todo su contenido si tiene una) y pide
  escribir **ELIMINAR**.
- Borra el usuario de `auth.users`; la cascada borra `public.users` y todo lo suyo. Los clics que
  registró quedan como filas anónimas (`outbound_clicks.user_id` es `on delete set null`).
- Si es dueño de una marca: imágenes de R2 de la marca primero (como en 1c/4b), después la cuenta.
- Al terminar: cierra la sesión y lleva a `/` con el aviso "Tu cuenta fue eliminada".
- El último admin no puede borrar su cuenta.

## Fuera de alcance

- Varias fotos por prenda o por look (sigue una).
- Que el staff borre cuentas de otros usuarios (puede cambiar su rol o eliminar su marca).
- Editar tallas y ciudades desde `/admin` (siguen por migración/seed).
- Historial o papelera de lo borrado.

## Pendiente al cerrar (2026-10-06)

- **Todo lo que sube o borra en R2** (en local no hay variables de R2): cambiar foto de prenda y de
  look, crear un look con foto, cambiar portada, y que al borrar prendas, looks, marcas o cuentas
  desaparezcan sus archivos del bucket. Lo que el staff sube gestionando no se bloquea por cuota.
- **Smoke test en producción** con una marca de prueba: Gestionar desde `/admin`, editar una prenda,
  archivar y restaurar un look, y cerrar la marca de prueba al final.
- **Instagram al gestionar:** "Conectar Instagram" usa la marca propia (`getMyBrand`), no la que
  gestiona el staff. Fuera de alcance: el staff no conecta Instagram por una marca.
- **Cuota al reemplazar una foto:** la nueva se suma antes de borrar la vieja, así que una marca
  muy cerca del límite podría no poder cambiar una foto aunque el total final cupiera.

## Ajustes después del cierre (2026-10-07)

- **Importación de Instagram apagada en producción.** Meta todavía no aprueba los permisos de la app,
  así que la importación queda solo para desarrollo. Se prende con `INSTAGRAM_IMPORT_ENABLED=true`
  (local y Preview/`dev` en Vercel); en Production la variable no existe. Sin ella:
  `/api/instagram/authorize`, `/api/instagram/callback` y `/marca/panel/import` dan 404, las acciones
  de importar devuelven error, el Resumen no muestra la tarjeta de Instagram, Looks no muestra
  "Importar" ni lo menciona, y un usuario sin marca ve "Registrar mi marca" (→ `/onboarding/marca`)
  en vez de "Conectar con Instagram". Se usa una variable y no se borra el código en `main` para
  que los merges `dev` → `main` no choquen.
- **Favicon nuevo:** la "I" de Icon en `src/app/favicon.ico` (16–256 px, fondo blanco para que se
  vea en pestañas oscuras). El ícono del manifest (`public/icon.svg`) sigue siendo el anterior.
- **Landing con contexto y footer:** `/` explica cómo funciona para usuarios y para marcas (3 pasos
  cada uno), cómo unirse (usuario o marca, con el paso de revisión), tres preguntas frecuentes y un
  footer (`SiteFooter`) con enlaces y el WhatsApp de contacto +57 315 242 9478 para ideas, dudas o
  info. El footer solo está en la landing.
- **Peso de imágenes en la nube:** al 2026-10-07 siguen en 0 bytes las 24 imágenes de prendas, las
  3 de posts y 9 portadas, así que la barra de almacenamiento marca ~0 % en todas las marcas. Se
  arregla con `npm run db:backfill-image-bytes` apuntando a la nube (ver `TODO.md`).
