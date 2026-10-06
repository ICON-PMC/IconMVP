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

## Grupo 2 — Etiquetas en la UI (depende de 1a–1d)

- **2a.** Helper `src/lib/tags.ts`: `getTagsByType()` y `saveTags(table, ownerId, type, ids)`
  (borra e inserta los de un tipo; reutilizado por panel, admin y onboarding).
- **2b. Prenda (panel):** `new-garment-form.tsx` y la edición de prenda ganan tres `ChipSelect`
  (Estilo, Ocasión, Clima). `createBrandGarment` / acción de edición los guardan.
- **2c. Prenda (`/admin` y carga masiva):** mismos campos en `upload-tab.tsx`; columnas `estilo`,
  `ocasion`, `clima` en `admin/bulk/actions.ts` y en la plantilla `.xlsx`.
- **2d. Borradores de Instagram:** el formulario para completar un borrador pide los mismos campos.
- **2e. Marca:** `ChipSelect` de estilos (máx. 5) en `profile-form.tsx` (registro), `profile-tab.tsx`
  (panel) y el formulario de marca de `/admin`.
- **2f. Mostrar:** chips de estilo en `/marca/[slug]` y en `BrandCard`; estilo/ocasión/clima en
  `/prenda/[id]`.
- **2g. `/admin` → Etiquetas:** lista por tipo, crear, renombrar, borrar si no está en uso.

## Grupo 3 — Ciudades en la UI (depende de 1e)

- **3a.** `src/components/city-combobox.tsx`: shadcn Popover + Command (o el Combobox de Base UI si
  ya está instalado), búsqueda sin acentos en el cliente sobre la lista (~1.100 filas, caben en
  memoria), muestra "Nombre, Departamento". Props `multiple`, `name`, `defaultValue`.
- **3b.** Usarlo en onboarding de usuario, `/settings`, registro de marca, perfil del panel (agregar
  `city` a la acción de guardar perfil) y formulario de marca de `/admin`.
- **3c.** Feed y búsqueda: el grupo "Ciudad" del `FeedFilterPanel` usa el combobox múltiple con solo
  ciudades con marcas activas. El parámetro de URL (`city=slug`) no cambia.

## Grupo 4 — Búsqueda (depende de 1c y 1f)

- **4a.** `src/app/feed/page.tsx`: pasar `p_styles` a `search_brands` y agregar el grupo Estilo a la
  pestaña Marcas.
- **4b.** `/admin` → Etiquetas → **Sinónimos**: lista de grupos (chips), crear, editar, borrar; y
  lista de palabras ignoradas.

## Grupo 5 — Verificación

Ver `validations.md`. `tsc`, `lint`, `next build`; `supabase db reset` local; pruebas en navegador
(incluido celular) de los formularios y de la búsqueda.
