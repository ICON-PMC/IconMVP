# Validations — Gestión completa para marcas y admin

Leyenda: **[build]** = `tsc`/`lint`/`build`; **[db]** = probado con SQL en Supabase local;
**[local]** = probado contra la app + Supabase local; **[nube]** = pendiente en producción.
En local no hay variables de R2: todo lo que sube o borra fotos se prueba en la nube.

## Base
- [ ] `deleteFromR2` borra un objeto de prueba y no lanza si la clave no existe. **[nube]**
- [x] `admin_list_users`: el curator ve los 5 usuarios de prueba y busca por correo sin
      mayúsculas; un usuario normal recibe "Solo el equipo puede ver la lista de usuarios." **[db]**
- [x] `set_user_role`: admin cambia user → curator; curator recibe "Solo un admin puede cambiar
      roles."; el propio rol da "No puedes cambiar tu propio rol." **[db]**
- [x] Un curator ya **no** puede ponerse `admin` con un UPDATE directo (antes sí). **[db]**
- [x] El registro de marca sigue pasando `user → brand`; `user → admin` directo se ignora. **[db]**
- [x] `close_brand`: otra marca recibe "No puedes cerrar esta marca."; el dueño la cierra y se van
      marca, prendas, follows y guardados; el clic queda anónimo; su rol vuelve a `user`. **[db]**
- [ ] La cookie de "gestionar" se ignora para un usuario que no es staff. **[local]**
- [x] `delete_my_account`: borra `auth.users` y en cascada `public.users` y follows (los clics se
      conservan); con marca, también la marca; el único admin recibe "Eres el único admin…". **[db]**

## Registro (bug)
- [x] Reproducido antes del arreglo: doble clic en "Crear cuenta" muestra "Este correo ya está
      registrado" y la cuenta queda creada y confirmada (local, 2026-10-06). **[local]**
- [x] Después del arreglo: el doble clic deja entrar al onboarding sin error. **[local]**
- [x] Un correo ya registrado con otra contraseña sigue mostrando "Este correo ya está registrado";
      con la contraseña correcta entra al onboarding. **[local]**

## Prendas
- [x] Editar prenda: abre con todo precargado (título, precio, link, categoría, tallas, estilos);
      un link inválido muestra "El link de compra no es válido."; guardar cambia título, precio,
      link (normalizado), tela, categoría, tallas (S,M → M,L) y estilos. **[local]**
- [ ] Cambiar la foto de una prenda reemplaza la imagen y borra la vieja de R2. **[nube]**
- [ ] Borrar prendas borra sus imágenes de R2. **[nube]**

## Looks
- [ ] Una marca sin Instagram crea un look (foto + caption) y llega al editor. **[nube]**
- [x] Si la foto no se puede subir, "Nuevo look" muestra "No pudimos subir la foto…" y no deja un
      borrador vacío (local, sin R2). **[local]**
- [x] Editar texto: "Texto guardado." y se guarda en la base. **[local]**
- [x] Botones por estado: borrador = Eliminar · Publicar; publicado = Archivar · Despublicar;
      archivado = Eliminar · Restaurar. **[local]**
- [x] Archivar: `/post/[id]` da 404 a un visitante; Restaurar lo deja en borrador; Eliminar (con
      confirmación) vuelve a Looks con "Look eliminado." y lo borra de la base. **[local]**
- [ ] `deletePost` sobre un look publicado responde error: cubierto por el filtro de estado en la
      consulta; sin prueba de navegador (la UI no ofrece el botón). **[local]**
- [ ] Cambiar la foto de un look y borrar su imagen de R2. **[nube]**
- [x] Filtro por estado en Looks (2 looks → Borradores muestra 1). **[local]**

## Perfil
- [ ] Cambiar portada reemplaza la imagen y borra la anterior de R2. **[nube]**
- [x] Sin R2, "Guardar portada" muestra "No pudimos subir la imagen…" sin romper nada. **[local]**
- [x] Cerrar cuenta: con "Sol" el botón queda deshabilitado; con "  sol caribe " se habilita; al
      confirmar llega a `/feed` con "Cerramos la cuenta de tu marca…", la marca, su prenda y su look
      desaparecen, el rol vuelve a `user` y `/marca/sol-caribe` da 404. **[local]**

## Borrar mi cuenta
- [ ] Usuario sin marca: escribe ELIMINAR, la cuenta desaparece de `auth.users` y no puede volver a
      entrar con esa contraseña. **[local]**
- [ ] Usuario con marca: se borran la marca y su contenido. **[local]** (imágenes de R2: **[nube]**)

## Admin
- [ ] Lista de todas las marcas con búsqueda y filtro de estado. **[local]**
- [ ] Desactivar una marca la saca del feed y de `/marca/[slug]` (404); reactivarla la devuelve. **[local]**
- [ ] Verificada / Sostenible se reflejan en la tarjeta y la página de la marca. **[local]**
- [ ] Gestionar: el panel muestra el aviso, edita una prenda de esa marca, Salir vuelve a `/admin`. **[local]**
- [ ] Lo que sube el staff gestionando no se bloquea por cuota. **[nube]**
- [ ] Eliminar marca desde `/admin` (con confirmación). **[local]**
- [ ] Usuarios: admin cambia un rol; curator ve la lista sin selects; el propio usuario sin select. **[local]**

## General
- [x] `supabase db reset` sin errores y las pruebas SQL del Grupo 1 dan lo mismo. **[db]**
- [x] `tsc`, `lint` y `next build` limpios tras el Grupo 1. **[build]**
- [x] `tsc` y `lint` limpios tras el Grupo 2. **[build]**
- [x] `tsc` y `lint` limpios tras el Grupo 3. **[build]**
- [x] `tsc` y `lint` limpios tras el Grupo 4. **[build]**
- [x] Migraciones del Grupo 1 aplicadas en la nube (2026-10-06): 6 funciones y el trigger de rol. **[nube]**
- [ ] Migraciones aplicadas en la nube antes de mergear a `main`. **[nube]**
