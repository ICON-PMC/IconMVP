# Plan — Etiquetas, ciudades y búsqueda

> Grupos ordenados por dependencia. El **Grupo 1 (esquema)** bloquea a todos los demás.
> Los Grupos 2, 3 y 4 son independientes entre sí. El **Grupo 5** es verificación.
>
> Las migraciones se aplican en la nube (SQL Editor) **antes** de mergear el código que las usa.
> `database.types.ts` se actualiza en el mismo commit que cada migración (constitución §7.4).

---

## Grupo 1 — Esquema ✅ (local, 2026-10-06)

Migraciones, en orden de aplicación:
1. `20261006000000_brand_tags.sql` — 1a, 1b y la parte de `feed_items` de 1c.
2. `20261006010000_more_tags.sql` — 1d.
3. `20261006020000_colombia_cities.sql` — 1e (generada por `scripts/build-cities-migration.ts`).
4. `20261006030000_search_synonyms.sql` — 1f y la parte de `search_*` de 1c (las 3 RPC se
   reescriben una sola vez).
5. `20261006040000_tag_usage.sql` — `tag_usage_counts()` para 2g (agregada en el Grupo 2).

Las migraciones 1–5 están aplicadas en la nube (2026-10-06). La 3 se reescribió como un solo
statement con CTE: el SQL Editor no conserva una tabla temporal entre statements.

- **1a. `brand_tags`**
  - `brand_id uuid references brands on delete cascade`, `tag_id uuid references tags on delete cascade`,
    PK `(brand_id, tag_id)`, índice en `tag_id`.
  - Trigger `before insert or update`: el tag debe ser `type = 'style'` y la marca no puede pasar de 5.
  - RLS: lectura `anon, authenticated`; dueño de la marca `for all` (mismo patrón que
    `garment_tags_owner_all`); staff `for all`.

- **1b. `garment_tags` multi-tipo** (misma migración)
  - Trigger: máximo 1 `category` y 3 por tipo (`style`, `occasion`, `temperature`) por prenda.
  - Actualizar el comentario de la tabla ("solo category" deja de ser cierto).
  - Revisar los lugares que hoy asumen que todo `garment_tags` es categoría
    (`src/app/prenda/[id]/page.tsx`, `src/lib/suggestions.ts`, `/admin`, carga masiva) y filtrar por
    `type = 'category'` donde haga falta.

- **1c. `feed_items` y `search_*`**
  - `feed_items` (rama `garment`): ocasiones/estilos = tags propios de la prenda ∪ heredados de posts.
  - `search_garments`: el texto de búsqueda suma los nombres de sus tags (subconsulta, igual que
    `search_posts`; `search_text` es columna generada y no puede leer otra tabla).
  - `search_brands`: suma los nombres de `brand_tags`; nuevo parámetro `p_styles text[]`.

- **1d. Vocabulario ampliado** (`on conflict do nothing`)
  - Propuesta, **confirmar con producto antes de aplicar**:
    - Estilo: Urbano, Romántico, Deportivo, Elegante, Y2K, Caribeño, Andino, Colorido,
      Neutro.
    - Ocasión: Noche, Día a día, Evento, Grado, Matrimonio.

- **1e. Ciudades**
  - `alter table cities add column department text, add column dane_code text unique`.
  - Datos: DIVIPOLA (datos.gov.co, dataset `gdxc-w37w` "DIVIPOLA- Códigos municipios", descargado
    2026-10-06: 1.122 filas = 1.103 municipios + 18 áreas no municipalizadas + 1 isla). CSV en
    `supabase/data/divipola.csv`; los `insert` los genera `scripts/build-cities-migration.ts`.
    153 municipios con nombre repetido llevan `nombre-departamento` (San Andrés: `-san-andres`).
  - Primero `update` de las 3 existentes por nombre → código (`11001` Bogotá, `05001` Medellín,
    `08001` Barranquilla); luego `insert … on conflict (dane_code) do nothing`.
  - Slug: `slugify(nombre)`; si se repite, `slugify(nombre-departamento)`. Nunca cambiar los 3 slugs
    existentes (están en URLs de filtros).
  - Índice trigram en `f_unaccent(lower(name))` para el combobox.

- **1f. Sinónimos**
  - `search_synonyms (id uuid pk, terms text[] not null, created_at)`, índice GIN en `terms`.
  - `search_stopwords (word text primary key)`.
  - RLS: lectura `anon, authenticated` (las RPC son `security invoker`); escritura solo staff.
  - Trigger que normaliza `terms`/`word` (minúsculas, `f_unaccent`, sin vacíos ni duplicados).
  - `public.search_terms(q text) returns table (alts text[])`: parte la consulta en palabras,
    quita stopwords, y para cada palabra devuelve `{palabra} ∪ terms` de los grupos que la contienen.
    Si no queda ninguna palabra, devuelve las originales.
  - `public.search_matches(txt, q)`: cada palabra útil coincide por sí misma (subcadena o
    `word_similarity >= 0.4`, como antes) **o** por un sinónimo como palabra completa (plural
    opcional). Lo estricto en los sinónimos evita que "gorra" → "cap" encuentre "capucha".
    Las 3 RPC la usan en lugar del `not exists (… regexp_split_to_table …)`.
  - Semilla inicial (normalizada):
    - hoodie, capucha, buzo, sudadera, hoody
    - jean, jeans, denim, vaquero
    - camiseta, tshirt, t-shirt, playera, remera
    - chaqueta, jacket, chamarra, campera
    - tenis, sneakers, zapatillas
    - zapatos, calzado, shoes
    - vestido, dress
    - falda, skirt
    - pantalon, pantalones, pants, trousers
    - bolso, cartera, bag
    - bikini, swimwear, banador
    - blusa, blouse
    - abrigo, coat
    - saco, sueter, sweater, jersey
    - shorts, short, pantaloneta, bermuda
    - gorra, cap
    - enterizo, jumpsuit, overol, mono
    - tropical, tropicales, caribe, caribeno, playero
  - Stopwords: marca, marcas, brand, brands, ropa, de, del, la, las, el, los, un, una, con, para, y,
    en, estilo, inspirado, inspirada, inspired, style.

---

## Grupo 2 — Etiquetas en la UI (depende de 1a–1d) ✅ (código, 2026-10-06; falta prueba en navegador)

- **2a.** Helper `src/lib/tags.ts`: `getTagOptions()`, `tagIdsFromForm()`, `replaceGarmentTags()`,
  `replaceBrandStyles()` y los máximos. `ChipSelect` gana `max`; `GarmentTagFields` agrupa los
  tres `ChipSelect` de la prenda.
- **2b. Prenda (panel):** `new-garment-form.tsx` gana Estilo, Ocasión y Clima. No había edición de
  prenda: tocar una prenda del catálogo abre la hoja **Etiquetas** (`garment-tags-sheet.tsx`,
  acción `updateGarmentTags`) con categoría + los tres tipos, para etiquetar el catálogo existente.
  También el paso 3 del registro de marca (`/onboarding/marca`).
- **2c. Prenda (`/admin` y carga masiva):** mismos campos en `upload-tab.tsx`; columnas `estilo`,
  `ocasion`, `clima` en `admin/bulk/actions.ts` y en la plantilla `.xlsx`.
- **2d. Borradores de Instagram:** son posts, no prendas, y el editor de looks ya pide ocasión,
  estilo y clima (`setPostTags`). Sin cambios.
- **2e. Marca:** `ChipSelect` de estilos (máx. 5) en `profile-form.tsx` (registro), `profile-tab.tsx`
  (panel) y el formulario de marca de `/admin`.
- **2f. Mostrar:** chips de estilo en `/marca/[slug]`; categoría + estilo/ocasión/clima en
  `/prenda/[id]`. Los estilos en `BrandCard` pasan al Grupo 4 (se tocan junto con la búsqueda).
- **2g. `/admin` → Etiquetas:** lista por tipo con usos, crear, renombrar (solo el nombre; el
  slug no cambia porque está en las URLs de filtros) y borrar si no está en uso. Los usos vienen
  de `tag_usage_counts()` (security definer, solo staff): con RLS el staff no ve las
  `user_preferences` de otros y habría podido borrar estilos elegidos por usuarios.

## Grupo 3 — Ciudades en la UI (depende de 1e) ✅ (2026-10-06)

`src/lib/cities.ts` (`getCityOptions`, `getCityFilterOptions`, `cityLabel`). **Ojo:** PostgREST
corta cada respuesta en 1.000 filas (`max_rows`) y hay 1.122 municipios; `getCityOptions` pide
por páginas. Cualquier `select` nuevo sobre `cities` sin filtro debe pasar por ahí.

- **3a.** `src/components/city-combobox.tsx`: Combobox de Base UI (ya instalado). `CityCombobox`
  (uno, dentro de un form, envía el id) y `CityMultiCombobox` (controlado, filtro del feed). Filtro
  sin acentos en el cliente, máximo 50 resultados pintados, etiqueta "Nombre, Departamento".
- **3b.** Usarlo en onboarding de usuario, `/settings`, registro de marca, perfil del panel (agregar
  `city` a la acción de guardar perfil) y formulario de marca de `/admin`.
- **3c.** Feed y búsqueda: el grupo "Ciudad" lista solo ciudades con marcas activas. Con más de 8
  el panel usa `CityMultiCombobox` (`searchable` en `FilterGroup`); con menos siguen los chips. El
  parámetro de URL (`city=slug`) no cambia.
- **3d.** `/marca/[slug]` y `/prenda/[id]` muestran "Ciudad, Departamento" (hay nombres repetidos).

## Grupo 4 — Búsqueda (depende de 1c y 1f) ✅ (2026-10-06)

- **4a.** `src/app/feed/page.tsx`: la pestaña Marcas pasa `p_styles` a `search_brands` y muestra el
  grupo Estilo en Filtros. `BrandCard` muestra los estilos (`getBrandStyleNames` en `tags.ts`).
- **4b.** `/admin` → Etiquetas, al final: **Sinónimos** (cada grupo editable como texto separado por
  comas, agregar, borrar) y **Palabras ignoradas** (agregar varias con coma, quitar una). La base
  normaliza y rechaza grupos de una sola palabra.

## Grupo 5 — Verificación

Ver `validations.md`. `tsc`, `lint`, `next build`; `supabase db reset` local; pruebas en navegador
(incluido celular) de los formularios y de la búsqueda.
