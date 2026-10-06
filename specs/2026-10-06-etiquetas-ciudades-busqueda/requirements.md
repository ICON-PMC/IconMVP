# Requirements — Etiquetas, ciudades y búsqueda

> **Estado (2026-10-06): construido y verificado en local; las 6 migraciones están en la nube.**
> Falta mergear `dev` → `main` y probar en producción lo de la sección "Pendiente" al final.

> Tres arreglos de descubrimiento después del piloto: las marcas no tienen etiquetas propias (no se
> puede buscar "marcas tropicales"), la carga de prendas no deja etiquetar estilo/ocasión/clima, solo
> hay 3 ciudades y la búsqueda no entiende términos cercanos ("hoodie" no encuentra "capucha").

## Decisiones (confirmadas con producto, 2026-10-06)

| # | Tema | Decisión |
|---|---|---|
| 1 | Vocabulario | **Lista fija, ampliada.** Se siguen usando los `tags` curados (`style`, `occasion`, `temperature`) y se agregan más. El staff crea nuevos desde `/admin`. Sin etiquetas libres. |
| 2 | Etiquetas de marca | La marca elige sus **estilos** (`type = 'style'`), máximo 5. |
| 3 | Etiquetas de prenda | Además de la categoría, la prenda elige **estilo, ocasión y clima** (`style`, `occasion`, `temperature`). Sigue heredando las de los posts que la etiquetan. |
| 4 | Ciudades | **Todos los municipios de Colombia** (DIVIPOLA del DANE, ~1.100), con departamento. Se eligen con un desplegable con búsqueda ("Rionegro, Antioquia"). |
| 5 | Filtro de ciudad en el feed | Solo lista ciudades con al menos una marca activa (si no, serían 1.100 opciones vacías). |
| 6 | Términos cercanos | **Tabla curada de sinónimos** en Postgres (es/en), editable desde `/admin`, más una lista de palabras de relleno que se ignoran. La búsqueda semántica (embeddings) sigue fuera de alcance (`roadmap.md`). |

## Estado actual (2026-10-06)

- `tags`: 15 categorías, 8 ocasiones, 7 estilos (incluye **Tropical**), 3 climas.
- `garment_tags` solo guarda la categoría; estilo/ocasión de una prenda salen de los posts que la
  etiquetan (`feed_items`). Ni el formulario del panel, ni `/admin`, ni el `.xlsx` piden más.
- No existe relación marca ↔ tag. `search_brands` solo ve tags de prendas y posts de la marca.
- `cities`: Barranquilla, Bogotá, Medellín (14 marcas y 6 usuarios apuntan a ellas).
- Las 3 RPC de búsqueda exigen que **cada palabra** coincida (subcadena o `word_similarity >= 0.4`).
  "marcas tropicales" no encuentra nada porque "marcas" no aparece en el texto de ninguna marca.

## 1. Etiquetas de marca

- Tabla nueva `brand_tags (brand_id, tag_id)`; un trigger rechaza tags que no sean `style` y más de 5
  por marca.
- La marca elige estilos en el registro (`/onboarding/marca`), en el panel (pestaña Perfil) y el
  staff en `/admin`. Chips, igual que el onboarding de usuario.
- Se muestran en `/marca/[slug]` y en la tarjeta de marca de la búsqueda.
- `search_brands` incluye los nombres de esos tags en su texto de búsqueda.
- La pestaña **Marcas** de la búsqueda gana el filtro **Estilo** (por `brand_tags`).

## 2. Etiquetas de prenda

- `garment_tags` acepta `category` (1 por prenda, como hoy) + `style`, `occasion`, `temperature`
  (varias, máximo 3 por tipo).
- Formulario de prenda del panel (crear y editar), formulario de `/admin`, completar borradores
  importados de Instagram y la plantilla `.xlsx` (columnas `estilo`, `ocasion`, `clima`, separadas
  por coma; un valor desconocido se omite con nota, igual que `categoria`).
- `feed_items`: las ocasiones/estilos de una prenda son **las propias ∪ las heredadas** de sus posts.
- `search_garments` incluye los nombres de los tags de la prenda en su texto de búsqueda.
- `/prenda/[id]` muestra estilo, ocasión y clima.

## 3. Vocabulario ampliado y gestión

- Se agregan estilos y ocasiones nuevos por migración (lista propuesta en `plan.md` 1d, a confirmar
  con producto antes de aplicar).
- `/admin` gana una pestaña **Etiquetas**: listar por tipo, crear y renombrar. Borrar solo si no se
  usa (para no vaciar filtros de golpe). Solo staff (la RLS de `tags` ya lo exige).

## 4. Ciudades de Colombia

- `cities` gana `department text` y `dane_code text unique`. Se cargan todos los municipios del
  DIVIPOLA. Las 3 filas existentes se conservan (mismo `id` y `slug`) y se completan por código DANE.
- `slug` = nombre sin acentos; si el nombre se repite en otro departamento, `nombre-departamento`.
- Componente nuevo `CityCombobox` (desplegable con búsqueda, sin acentos, muestra el departamento).
  Reemplaza los chips/selects de: onboarding de usuario, `/settings`, registro de marca, perfil del
  panel de marca (hoy no deja cambiar la ciudad: se agrega) y formulario de marca de `/admin`.
- Filtro de ciudad del feed y de la búsqueda: mismo combobox con selección múltiple, solo ciudades
  con marcas activas (decisión 5).

## 5. Búsqueda con términos cercanos

- Tabla `search_synonyms (id, terms text[])`: cada fila es un grupo de equivalentes ya normalizados
  (minúsculas, sin acentos). Ej.: `{hoodie, capucha, buzo, sudadera}`.
- Tabla `search_stopwords (word text primary key)`: palabras que se ignoran en la consulta
  ("marca", "marcas", "de", "con", "para", "estilo", "inspirado", "inspired", "brand"…).
- Función `public.search_terms(q)` → una fila por palabra útil con su arreglo de alternativas
  (la palabra + sus sinónimos). Las 3 RPC la usan: una palabra coincide si **alguna** alternativa
  coincide (misma regla de subcadena o `word_similarity >= 0.4`). Si todas las palabras eran de
  relleno, se busca con la consulta original.
- `/admin`, pestaña **Etiquetas**, sección **Sinónimos**: listar, crear, editar y borrar grupos.
- Se siembra una lista inicial de moda es/en (plan 1f).

## Fuera de alcance

- Etiquetas libres escritas por la marca (decisión 1).
- Búsqueda semántica / embeddings.
- Sinónimos de frases de varias palabras ("traje de baño" = "vestido de baño"): el MVP trabaja palabra
  por palabra; se anota si aparece en las pruebas.
- Ciudades fuera de Colombia.

## Pendiente al cerrar (2026-10-06)

Lo que no se pudo probar en local o quedó para producto. El detalle de cada prueba está en
`validations.md`.

- **Producto:** revisar los 9 estilos y 5 ocasiones nuevos (`20261006010000_more_tags.sql`). Se
  renombran o borran desde `/admin` → Etiquetas mientras no estén en uso.
- **Smoke test en producción** (después del merge):
  - "Nueva prenda" del panel con foto, eligiendo estilo/ocasión/clima (en local no hay R2).
  - Ciudad en `/settings` y en el registro de marca, desde un celular real.
  - Buscar "hoodie" y "marcas tropicales"; agregar un sinónimo en `/admin` y ver que aplica sin desplegar.
  - El filtro de ciudad del feed lista solo ciudades con marcas.
- **Etiquetar el catálogo existente:** las prendas y marcas del piloto no tienen estilos todavía;
  hasta que las marcas (o el staff) los pongan, "marcas tropicales" no encuentra nada en producción.
- **Fuera de alcance, anotado:** sinónimos de varias palabras ("traje de baño" = "bikini");
  `popular_content_tags` (chips de sugerencia) solo cuenta tags de posts, no los propios de prendas.
