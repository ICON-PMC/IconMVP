# Validations — Etiquetas, ciudades y búsqueda

Leyenda: **[build]** = `tsc`/`lint`/`build`; **[db]** = probado con SQL en Supabase local;
**[local]** = probado contra `next start` + Supabase local; **[nube]** = pendiente en producción.

## Etiquetas
- [x] `brand_tags` rechaza un tag que no es `style` y un sexto estilo. **[db]**
- [x] `garment_tags` rechaza una segunda categoría y un cuarto tag del mismo tipo. **[db]**
- [x] Una marca dueña puede editar sus `brand_tags`; otra marca y `anon` no. **[db]**
- [ ] "Nueva prenda" del panel guarda estilo/ocasión/clima. **[nube]** En local no hay variables
      de R2 y la foto es obligatoria: probar en el smoke test. El mismo guardado ya se probó por la
      hoja Etiquetas, `/admin` y la carga masiva.
- [x] La plantilla trae las columnas `estilo`, `ocasion`, `clima`; una fila con
      "Tropical, Inventado" / "Brunch, Viaje" / "Cálido" guarda Tropical, Brunch, Viaje y Cálido y
      omite "Inventado". **[local]**
- [x] Panel → Perfil: la marca elige Tropical y Caribeño y se ven en `/marca/sol-caribe`. **[local]**
- [ ] Registro de marca (`/onboarding/marca`, paso 1) guarda los estilos. **[local]** Mismo
      componente y helper que el panel; no se recorrió el registro completo (el paso 2 pide foto).
- [x] SQL: `feed_items` muestra los estilos/ocasiones propios de una prenda sin post y
      `get_feed(p_styles => {y2k})` la encuentra. **[db]**
- [x] Filtrar el feed por estilo muestra prendas con ese estilo propio: probado en SQL con
      `get_feed(p_styles => {y2k})`, que es lo que llama `/api/feed`. **[db]**
- [x] `tag_usage_counts()` cuenta las preferencias de otros usuarios para el staff y rechaza a un
      usuario normal. **[db]**
- [x] `/admin` → Etiquetas: crear "Prueba Borrar", renombrarla y borrarla; "Tropical" con 3 usos
      tiene Borrar deshabilitado. **[local]**
- [x] Panel → Catálogo: "Agregar etiquetas" abre la hoja, el 4º estilo queda deshabilitado y se
      guardan categoría + Tropical/Urbano/Y2K + Casual + Cálido; `/prenda/[id]` los muestra. **[local]**
- [x] `/admin` → prenda (sin foto) guarda Faldas + Boho + Beachwear; `/admin` → marca guarda
      Andino + Minimalista y Rionegro, Antioquia. **[local]**

## Ciudades
- [x] `cities` tiene ~1.100 filas con `department` y `dane_code`; los 3 slugs viejos siguen igual y
      las marcas/usuarios que apuntan a ellos no cambian. **[db]**
- [x] No hay slugs repetidos. **[db]**
- [x] El combobox encuentra "Medellin" sin tilde y "Rionegro" muestra los dos departamentos;
      el onboarding guarda Medellín en `home_city_id` (Chrome headless, 390 px). **[local]**
- [x] Onboarding, perfil del panel (Cartagena de Indias, Bolívar) y `/admin` (Rionegro, Antioquia)
      guardan la ciudad. **[local]**
- [ ] `/settings` y el registro de marca guardan la ciudad. **[local]** Mismo componente con
      `name="city"`; las acciones no cambiaron.
- [ ] El filtro de ciudad del feed solo lista ciudades con marcas activas; `?city=bogota` sigue
      funcionando. **[nube]** Hoy son 3 ciudades (chips); el buscador múltiple aparece desde 9.
- [x] El combobox funciona a 390 px de ancho (escribir, elegir, enviar). **[local]**
- [ ] Probarlo en un celular real (teclado en pantalla, scroll de la lista). **[nube]**

## Búsqueda
- [x] SQL: `search_garments('hoodie')` → "Buzo con capucha"; "gorra" no trae la capucha;
      `search_brands('marcas tropicales')`, `('tropical inspired brands')` y `p_styles => {boho}`
      traen la marca con esos estilos; `('de la')` no rompe. **[db]**
- [x] "hoodie" encuentra una prenda titulada "Buzo con capucha" en la pestaña Prendas. **[local]**
- [x] "marcas tropicales" encuentra la marca con estilo Tropical y su tarjeta muestra los estilos;
      la pestaña Marcas tiene el filtro Estilo. **[local]**
- [x] Una consulta solo con palabras ignoradas ("de la") no rompe la búsqueda. **[db]**
- [x] Las búsquedas de antes siguen funcionando (`abrigos`, el nombre de una marca). **[db]**
- [x] `/admin` → Sinónimos: "Chaleco, Vest" se guarda normalizado (`{chaleco,vest}`); un grupo de una
      sola palabra muestra el error en español; agregar "tienda" a ignoradas funciona. **[local]**
- [ ] Un grupo nuevo se aplica a la siguiente búsqueda sin desplegar (probar en la nube). **[nube]**
- [x] `anon` puede leer sinónimos pero no escribirlos. **[db]**

## General
- [x] `supabase db reset` aplica todas las migraciones + `seed.sql` sin errores, y las pruebas SQL
      dan lo mismo sobre la base limpia. **[db]**
- [x] Tras el reset faltaba `select` en `post_likes`, `garment_likes` y `brand_follows` (el feed
      local fallaba): migración `20261006050000_grant_select_social.sql`. **[db]**
- [x] `tsc`, `lint` y `next build` limpios tras el Grupo 2. **[build]**
- [x] `tsc` y `lint` limpios tras el Grupo 3. **[build]**
- [x] `tsc`, `lint` y `next build` limpios tras el Grupo 4. **[build]**
- [x] Migraciones 1–4 aplicadas en la nube (2026-10-06). **[nube]**
- [x] Migración `20261006040000_tag_usage.sql` aplicada en la nube (2026-10-06). **[nube]**
- [ ] Migración `20261006050000_grant_select_social.sql` aplicada en la nube (no cambia nada allá:
      ya tiene esos permisos; es para que la nube y el repo coincidan). **[nube]**
