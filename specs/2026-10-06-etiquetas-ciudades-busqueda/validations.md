# Validations — Etiquetas, ciudades y búsqueda

Leyenda: **[build]** = `tsc`/`lint`/`build`; **[db]** = probado con SQL en Supabase local;
**[local]** = probado contra `next start` + Supabase local; **[nube]** = pendiente en producción.

## Etiquetas
- [ ] `brand_tags` rechaza un tag que no es `style` y un sexto estilo. **[db]**
- [ ] `garment_tags` rechaza una segunda categoría y un cuarto tag del mismo tipo. **[db]**
- [ ] Una marca dueña puede editar sus `brand_tags`; otra marca y `anon` no. **[db]**
- [ ] Crear una prenda desde el panel con estilo/ocasión/clima los guarda y se ven en `/prenda/[id]`. **[local]**
- [ ] El `.xlsx` con `estilo`, `ocasion`, `clima` los guarda; un valor desconocido queda como nota. **[local]**
- [ ] Una marca elige estilos en el registro y en el panel; se ven en `/marca/[slug]`. **[local]**
- [ ] Filtrar el feed por estilo muestra prendas con ese estilo propio (sin post que las etiquete). **[local]**
- [ ] `/admin` → Etiquetas: crear y renombrar; borrar un tag en uso está bloqueado. **[local]**

## Ciudades
- [ ] `cities` tiene ~1.100 filas con `department` y `dane_code`; los 3 slugs viejos siguen igual y
      las marcas/usuarios que apuntan a ellos no cambian. **[db]**
- [ ] No hay slugs repetidos. **[db]**
- [ ] El combobox encuentra "Medellin" sin tilde y "Rionegro" muestra los dos departamentos. **[local]**
- [ ] Onboarding, `/settings`, registro de marca, perfil del panel y `/admin` guardan la ciudad. **[local]**
- [ ] El filtro de ciudad del feed solo lista ciudades con marcas activas; `?city=bogota` sigue funcionando. **[local]**
- [ ] El combobox se usa bien en celular (teclado, scroll de la lista). **[local]**

## Búsqueda
- [ ] "hoodie" encuentra una prenda titulada "Buzo con capucha" y viceversa. **[local]**
- [ ] "marcas tropicales" y "tropical inspired brands" encuentran las marcas con estilo Tropical. **[local]**
- [ ] Una consulta solo con palabras ignoradas ("de la") no rompe la búsqueda. **[local]**
- [ ] Las búsquedas de antes siguen dando lo mismo (`abrigos`, nombre de una marca, una palabra de un caption). **[local]**
- [ ] `/admin` → Sinónimos: un grupo nuevo se aplica a la siguiente búsqueda sin desplegar. **[local]**
- [ ] `anon` puede leer sinónimos pero no escribirlos. **[db]**

## General
- [ ] `supabase db reset` aplica todas las migraciones sin errores. **[db]**
- [ ] `tsc`, `lint` y `next build` limpios. **[build]**
- [ ] Migraciones aplicadas en la nube antes de mergear a `main`. **[nube]**
