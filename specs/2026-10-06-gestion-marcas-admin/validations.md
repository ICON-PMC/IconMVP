# Validations — Gestión completa para marcas y admin

Leyenda: **[build]** = `tsc`/`lint`/`build`; **[db]** = probado con SQL en Supabase local;
**[local]** = probado contra la app + Supabase local; **[nube]** = pendiente en producción.
En local no hay variables de R2: todo lo que sube o borra fotos se prueba en la nube.

## Base
- [ ] `deleteFromR2` borra un objeto de prueba y no lanza si la clave no existe. **[nube]**
- [ ] `admin_list_users`: staff ve todos; un usuario normal recibe error. **[db]**
- [ ] `set_user_role`: admin cambia el rol de otro; curator, el propio rol y quitar el último admin
      dan error en español. **[db]**
- [ ] El registro de marca sigue pasando `user → brand` con el trigger ajustado. **[db]**
- [ ] `close_brand`: el dueño borra su marca (prendas, looks, tags, follows desaparecen; clics
      quedan con `brand_id` nulo; su rol vuelve a `user`); otra marca no puede. **[db]**
- [ ] La cookie de "gestionar" se ignora para un usuario que no es staff. **[local]**
- [ ] `delete_my_account`: borra `auth.users` y en cascada `public.users`, guardados, likes y
      follows; con marca, también la marca; el último admin recibe error. **[db]**

## Registro (bug)
- [x] Reproducido antes del arreglo: doble clic en "Crear cuenta" muestra "Este correo ya está
      registrado" y la cuenta queda creada y confirmada (local, 2026-10-06). **[local]**
- [ ] Después del arreglo: el doble clic deja entrar al onboarding sin error. **[local]**
- [ ] Un correo ya registrado con otra contraseña sigue mostrando "Este correo ya está registrado". **[local]**

## Prendas
- [ ] Editar título, precio, link, tallas y etiquetas de una prenda existente. **[local]**
- [ ] Cambiar la foto de una prenda reemplaza la imagen y borra la vieja de R2. **[nube]**
- [ ] Borrar prendas borra sus imágenes de R2. **[nube]**

## Looks
- [ ] Una marca sin Instagram crea un look (foto + caption) y llega al editor. **[nube]**
- [ ] Editar caption. **[local]**
- [ ] Borrador → Eliminar; Publicado → Archivar (sale del feed) → Restaurar (borrador) / Eliminar. **[local]**
- [ ] `deletePost` sobre un look publicado responde error (validación en servidor). **[local]**
- [ ] Filtro por estado en Looks. **[local]**

## Perfil
- [ ] Cambiar portada reemplaza la imagen y borra la anterior de R2. **[nube]**
- [ ] Cerrar cuenta: con el nombre mal escrito no hace nada; bien escrito borra todo y la persona
      queda como usuario en `/feed`. **[local]**

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
- [ ] `supabase db reset` sin errores. **[db]**
- [ ] `tsc`, `lint` y `next build` limpios. **[build]**
- [ ] Migraciones aplicadas en la nube antes de mergear a `main`. **[nube]**
