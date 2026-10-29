# Importar el catálogo de una marca (Shopify → Excel + fotos)

Convierte el catálogo de una tienda **Shopify** en:

- un **Excel** con las columnas que espera `/admin/bulk`, y
- una **carpeta de fotos** (la foto principal de cada prenda).

Después subes el Excel y las fotos desde el panel. Nada se publica solo: las prendas entran como `pending` y pasan a `published` cuando les subes la foto.

> **Solo con consentimiento.** Úsalo únicamente con marcas que te autorizaron a usar su catálogo **y sus fotos**. El script exige el flag `--consentimiento` y deja un registro en `origen.json`.

---

## Antes de empezar

1. **La marca ya debe existir en Icon.** Créala en `/admin` si hace falta. El importador la busca por nombre, así que usa el **nombre exacto** (o el slug) en `--marca`.
2. **Instala dependencias** una vez: `npm install`.
3. Necesitas Node 20+ (el proyecto ya lo exige).
4. **El script lee de tu base las categorías, tallas, marcas, estilos, ocasiones y climas válidos** (con la anon key de `.env.local`; son tablas públicas). Así el Excel usa los nombres **exactos** que acepta el importador. Al arrancar te dice de qué base las leyó (`127.0.0.1:54321` = local; si el `.env.local` apunta a la nube, serán las de la nube). Si no hay conexión, usa una lista de respaldo y te avisa.
5. **Si el catálogo trae tallas numéricas** (jeans 4–14, cintura 28–32…), aplica antes la migración `supabase/migrations/20261029000000_numeric_sizes.sql`. Ver «Tallas numéricas» más abajo.

---

## Camino recomendado: el CSV que exporta la marca

No toca la tienda y no depende de límites de velocidad.

**1. Pídele a la marca el CSV de productos.** Puedes mandarle esto:

> Hola, para cargar tu catálogo en Icon necesito el archivo de productos de tu tienda Shopify. En tu admin: **Productos → Exportar → Todos los productos → "CSV para Excel, Numbers u otros programas de hoja de cálculo" → Exportar productos**. Te llega por correo (o se descarga). ¿Me lo compartes? Con ese archivo preparo tu catálogo; antes de publicar nada te muestro cómo queda. (Los nombres exactos de los botones pueden variar un poco según el idioma del admin.)

**2. Genera el Excel y las fotos:**

```bash
npm run catalog:excel -- \
  --marca "Under Gold" \
  --csv ~/Downloads/products_export_1.csv \
  --url https://undergoldapparel.com \
  --contacto tucorreo@icon.co \
  --consentimiento
```

- `--url` es opcional con `--csv`, pero **sin él la columna `url_producto` queda vacía**. Pon solo el dominio; no hace falta la URL larga con `gclid`.
- Las fotos se bajan desde el CDN de Shopify (el CSV trae sus URLs). Si no quieres fotos todavía, agrega `--sin-fotos`.

---

## Alternativa: leer la tienda en vivo

Solo si la marca está de acuerdo. Lee `/products.json`, que Shopify expone públicamente.

```bash
npm run catalog:excel -- \
  --marca "Under Gold" \
  --url https://undergoldapparel.com \
  --contacto tucorreo@icon.co \
  --consentimiento \
  --max 5        # primera prueba con 5 productos
```

Cómo se porta con la tienda:

- Se identifica con un User-Agent claro (`IconCatalogBot/1.0 (+tu correo …)`).
- Respeta `robots.txt`: si prohíbe `/products.json`, se detiene.
- Espera **2 s entre peticiones** (`--pausa` para cambiarlo) y baja las fotos de una en una.
- Si la tienda responde **429/503** ("espera"), obedece `Retry-After`, reintenta pocas veces y, si sigue, **se detiene con un mensaje**. No intenta esquivar el límite. Cuando pase, pídele el CSV a la marca.

Con una tienda real que limite las peticiones (por ejemplo, `undergoldapparel.com` devolvió `429` en una prueba rápida), esta vía puede no funcionar. Ahí el CSV es el camino.

---

## Qué genera

```
catalog-export/under-gold/
├── catalogo.xlsx    ← hoja "Prendas"
├── fotos/
│   ├── 001-vestido-midi-ana.jpg
│   ├── 002-jean-mom-fit.jpg
│   └── …
└── origen.json      ← de dónde salió, cuándo, quién confirmó consentimiento
```

`catalog-export/` está en `.gitignore`: **no commitees fotos ni catálogos de las marcas**.

### Columnas del Excel

| Columna | De dónde sale |
|---|---|
| `marca` | lo que pasaste en `--marca` |
| `titulo` | título del producto |
| `descripcion` | descripción sin HTML (máx. ~700 caracteres) |
| `precio_cop` | precio **más bajo** entre las variantes, como entero |
| `url_producto` | `{tienda}/products/{handle}` |
| `color` | opción "Color" (varios separados por coma) |
| `tela` | **vacía**: Shopify no la trae; llénala a mano si la quieres |
| `categoria` | inferida por palabras clave; **vacía si no hay certeza**. Tiene **lista desplegable** con las categorías de la base |
| `tallas` | opción "Talla"/"Size", traducida a las tallas de Icon. Las que **no existan en Icon** no se escriben y quedan avisadas en `revisar` |
| `estilo`, `ocasion`, `clima` | hasta **3 por columna**, separados por coma. Se **prellenan solo si un tag de la tienda coincide exactamente** con uno de Icon (ver «Estilo, ocasión y clima»); si no, quedan vacías para que las elijas. Tienen desplegable |
| `foto` | nombre del archivo en `fotos/` (solo para ti; el importador la ignora) |
| `revisar` | avisos para ti (el importador la ignora) |

El Excel trae además una hoja **«Referencia (no editar)»** (marcas, categorías, tallas, estilos, ocasiones y climas válidos, igual que la plantilla de `/admin/bulk`) y **desplegables estrictos** en `marca` y `categoria`: eliges de la lista y no tienes que adivinar cómo se escribe. En `tallas` no hay desplegable porque Excel no permite elegir varias a la vez; escribe separadas por coma lo que aparece en la hoja de referencia.

Lo que **no** hace el script y debes revisar: `tela`, las categorías vacías, las tallas que no existen en Icon, y elegir `estilo`/`ocasion`/`clima` donde la tienda no traía un tag que coincidiera.

---

## Paso a paso después de generar

### 1. Revisa el Excel

Ábrelo y mira, sobre todo, la columna **`revisar`**:

| Aviso | Qué hacer |
|---|---|
| `asignar categoría` | Elige una de la lista desplegable de la celda (son las 15 categorías de la base). Si la dejas vacía, la prenda se crea sin categoría. |
| `talla que no existe en Icon (se omite al importar)` | Esa talla no está en la base. Agrégala (ver «Tallas numéricas») y vuelve a generar, o escríbela a mano en el Excel si ya la agregaste. |
| `sin talla` | Normal en bolsos y accesorios. |
| `más de 3 de estilo/ocasión/clima en la tienda: se dejaron 3` | El importador acepta máx. 3 por tipo. El script dejó los 3 primeros; cambia cuál se queda si quieres otros. |
| `sin precio` | Complétalo; el precio es lo que habilita el filtro por rango. |
| `precio en USD, no COP` | Convierte `precio_cop` a pesos antes de importar. |
| `la tienda no trae foto` / `foto no descargada` | Consíguela con la marca. |
| `foto > 10 MB` | El panel rechaza fotos de más de 10 MB; reduce su tamaño. |

> Los precios se copian **tal cual** de la tienda. Confirma que están en pesos colombianos.

Puedes borrar filas que no quieras importar.

### 2. Sube el Excel

`/admin/bulk` → **Paso 1**: sube `catalogo.xlsx`. Verás un resultado por fila. Si dice `Marca no encontrada`, el valor de `marca` no coincide con el nombre en Icon.

### 3. Sube las fotos

En **Paso 2** aparece cada prenda pendiente sin foto. Para cada una:

1. Pulsa **Elegir foto** y toma el archivo de `fotos/` que corresponde. El nombre trae el título (`003-camiseta-basica.jpg`), así que es fácil de emparejar.
2. Cuando tengas todas, pulsa **Subir N fotos**. Cada prenda pasa a **publicada** y aparece en el feed.

La foto que elijas se reduce a máx. 1280 px y se guarda en WebP.

---

## Tallas numéricas

La base solo traía tallas de letras (XXXS…XXXL, Onesize, Plussize). Las numéricas estaban pensadas para "crearse bajo demanda", pero ningún flujo lo hacía: ni el panel de marca ni `/admin/bulk` pueden crear tallas, solo listan las que existen. Por eso una talla como la **14** no aparecía en el panel y el importador la **omitía** (la prenda se creaba, pero sin esa talla).

La migración `20261029000000_numeric_sizes.sql` siembra un conjunto acotado:

- **2, 4, 6, 8, 10, 12, 14, 16, 18** — tallaje numérico de ropa de mujer
- **24, 26, 28, 30, 32, 34, 36** — cintura de jeans

Es idempotente (`on conflict do nothing`): si ya tienes alguna, la respeta. Para **agregar otra** (por ejemplo la 38), añádela a la lista de la migración antes de aplicarla, o inserta una fila en `sizes` con `system = 'numeric'`.

Cómo aplicarla:

- **Local:** `supabase migration up` (si el CLI dice que el historial no coincide, es que tu base local viene de otra rama; en ese caso ejecuta el contenido del archivo con `psql`, es seguro repetirlo).
- **Nube:** pega el contenido del archivo en el SQL Editor de Supabase. Aplícala **antes** de importar, porque las tallas que no existan se omiten.

Después de aplicarla, las tallas aparecen en el panel de marca y en `/admin`, y el script las reconoce.

## Estilo, ocasión y clima

El importador de `/admin/bulk` acepta las columnas `estilo`, `ocasion` y `clima` y las guarda como etiquetas **de la prenda** (`garment_tags`). Máximo **3 por tipo**; lo que sobre se omite con aviso. El script las genera igual que la plantilla web.

**Qué prellena el script, y qué no.** Mira los tags que la tienda tiene en cada producto (más su "tipo de producto") y copia **solo los que coinciden exactamente** (sin importar mayúsculas ni acentos) con el nombre o el slug de una etiqueta de Icon. Ejemplo: un producto con los tags `denim, Casual, STREETWEAR, Verano 2026` queda con ocasión `Casual` y estilo `Streetwear`; `denim` y `Verano 2026` se ignoran porque no existen en Icon.

**No infiere nada del título ni de la descripción**: sería adivinar, y una prenda mal etiquetada aparece en filtros equivocados. Lo que la tienda no traiga queda **vacío para que lo elijas tú** en el Excel. Es normal que muchas filas queden vacías: las tiendas casi nunca usan el vocabulario de Icon.

**Cómo se llenan a mano.** Cada columna tiene una lista desplegable con los valores válidos. A diferencia de `marca` y `categoria`, el desplegable **no bloquea** lo que escribas, porque Excel solo deja elegir un valor y aquí caben hasta 3: elige uno de la lista, o escribe varios separados por coma (`Casual, Formal`). Un valor que no exista en Icon se omite al importar, con aviso en el resultado.

## Limitaciones

- **Solo Shopify** por ahora. Para WooCommerce u otras plataformas habría que añadir otra fuente.
- **Una foto por prenda** (la de posición 1). Las demás se ignoran: `/admin/bulk` solo sube una.
- La categoría por palabras clave es una **sugerencia**, no una verdad. Revísala.
- Estilo/ocasión/clima solo se prellenan con coincidencias exactas de los tags de la tienda; el resto lo eliges tú.
- No inicia sesión en ninguna tienda, no usa credenciales y no toca la base de datos de Icon.

## Referencia rápida de opciones

```
--marca "Nombre"      OBLIGATORIO  nombre exacto de la marca en Icon
--consentimiento      OBLIGATORIO  confirma que la marca autorizó
--csv  archivo.csv                 CSV exportado del admin de Shopify
--url  https://...                 tienda (en vivo, o base de url_producto con --csv)
--contacto correo                  va en el User-Agent
--pausa 2000                       ms entre peticiones a la tienda
--max N                            solo los primeros N productos
--sin-fotos                        no descarga fotos
--salida carpeta                   por defecto catalog-export
--ayuda                            muestra esta lista
```
