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
- [x] La cookie de "gestionar" se ignora para un usuario que no es staff: la dueña de Sol Caribe con
      la cookie de Niebla sigue viendo Sol Caribe y sin aviso. **[local]**
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
- [x] Usuario sin marca: escribe "eliminar", llega a `/feed` con "Tu cuenta fue eliminada.", ya no
      está en `auth.users` y el login da "Correo o contraseña incorrectos." **[local]**
- [x] Usuario con marca: se borran la cuenta, la marca y su prenda. **[local]** (imágenes de R2: **[nube]**)

## Admin
- [x] Lista de todas las marcas; buscar "nieb" deja solo Niebla. **[local]**
- [x] Desactivar Sol Caribe: `/marca/sol-caribe` da 404 a un visitante; reactivarla, 200. **[local]**
- [x] Verificada se guarda desde la lista. **[local]** (que se vea en la tarjeta: ya lo hacía)
- [x] Gestionar Niebla: aviso "Estás gestionando Niebla", edita su prenda ("Prenda guardada."),
      Salir vuelve a `/admin?tab=marcas`. **[local]**
- [ ] Lo que sube el staff gestionando no se bloquea por cuota. **[nube]**
- [x] Eliminar Niebla desde `/admin` escribiendo su nombre: "Eliminamos Niebla." y sale de la lista. **[local]**
- [x] Usuarios: admin ve selector en todos menos en su fila ("Admin (tú)"); cambia user → curador
      ("…ahora es Curador."); curator ve la lista sin selectores. **[local]**

## General
- [x] `supabase db reset` sin errores y las pruebas SQL del Grupo 1 dan lo mismo. **[db]**
- [x] `tsc`, `lint` y `next build` limpios tras el Grupo 1. **[build]**
- [x] `tsc` y `lint` limpios tras el Grupo 2. **[build]**
- [x] `tsc` y `lint` limpios tras el Grupo 3. **[build]**
- [x] `tsc` y `lint` limpios tras el Grupo 4. **[build]**
- [x] Cierre: `supabase db reset`, `lint` y `next build` limpios tras el Grupo 5. **[build]**
- [x] Migraciones del Grupo 1 aplicadas en la nube (2026-10-06): 6 funciones y el trigger de rol. **[nube]**
- [ ] Migraciones aplicadas en la nube antes de mergear a `main`. **[nube]**

## Ajustes 2026-10-07
- [x] `tsc`, `lint` y `next build` limpios con la variable de Instagram. **[build]**
- [x] Favicon legible a 16 y 32 px. **[local]**
- [ ] `INSTAGRAM_IMPORT_ENABLED=true` solo en Preview en Vercel; en Production sin la variable. **[nube]**
- [ ] En producción: el Resumen no muestra Instagram, Looks no muestra "Importar" y
      `/marca/panel/import` y `/api/instagram/authorize` dan 404. **[nube]**
- [ ] En el Preview de `dev`: la importación sigue funcionando. **[nube]**
- [ ] Peso de imágenes rellenado en la nube y la barra del Resumen ya no marca 0 %. **[nube]**
