# Research: Importar catálogo desde el panel de carga masiva

Cada sección: **Decisión · Razón · Alternativas descartadas**. Ningún `NEEDS CLARIFICATION` queda abierto.

## 1. Cómo correr una lectura larga en Vercel

**Decisión**: corrida *por tandas guiadas por el cliente*. El estado vive en la tabla `catalog_runs`
(fase + cursor). El navegador llama a `advanceCatalogRun(runId)` en bucle; cada llamada hace trabajo
hasta un presupuesto de ~40 s y devuelve el progreso. Se declara `export const maxDuration = 60` en
`/admin/bulk/page.tsx` (lo heredan las server actions de la página).

**Razón**:
- El tiempo no está en leer el catálogo (Shopify devuelve hasta 250 productos por página; un catálogo
  típico son 1 a 2 peticiones con 2 s de pausa) sino en **descargar una foto por prenda** (~1 a 2 s cada
  una con la pausa de cortesía): 100 prendas ≈ 2 a 3 min, más de lo que tolera una sola petición en un plan
  sin Fluid compute (60 s) y en el límite de las demás.
- Ningún trabajo "en segundo plano" sobrevive a la respuesta en serverless; el bucle del cliente sí es
  observable (progreso real) y, al estar el estado en la base, **cerrar la pestaña no pierde nada**
  (FR-009): al volver se ofrece *continuar* o *empezar de nuevo*.
- Cada tanda es idempotente: avanza con *compare-and-set* sobre `(id, phase, cursor)`; si dos pestañas
  avanzan a la vez, una gana y la otra recibe el estado actual.

**Alternativas descartadas**:
- *Una sola petición larga*: topa con el límite de duración y no da progreso.
- *Cola/worker externo (Inngest, QStash, Vercel Queues)*: infraestructura nueva para 10 marcas; viola VIII.
- *Vercel Cron*: granularidad de minutos y sin canal de progreso hacia la UI.
- *Correrlo en el navegador (fetch a la tienda)*: CORS lo bloquea y expondría el contacto/robots a cada cliente.

## 2. Dónde guardar el avance, las fotos y el Excel

**Decisión**: la corrida (productos leídos, notas por fila, nombre de foto, estado) en `catalog_runs`
(`jsonb`); las **fotos originales y el Excel** en R2 bajo `catalog-runs/<runId>/…` con la clave de cada
objeto anotada en la fila. Purga de corridas vencidas (7 días) de forma oportunista al abrir
`/admin/bulk` (borra objetos con `deleteFromR2` y la fila), más una regla de ciclo de vida de R2 sobre el
prefijo como respaldo (tarea de configuración manual, documentada).

**Razón**: no hay disco; R2 ya está en el stack y sin costo de egreso. La cuota de marca se calcula con
`brand_storage_bytes` sobre tablas de contenido, así que el almacén temporal **no cuenta** contra los
300 MB (se verifica en el quickstart). Las claves viajan con la fila, por lo que no hace falta listar R2.

**Alternativas descartadas**: Supabase Storage (otro sistema de archivos que mantener); guardar las fotos
en Postgres (`bytea`) por peso; `/tmp` de la función (se pierde entre invocaciones).

**Riesgo asumido**: el bucket se sirve público por `pub-*.r2.dev`; las fotos temporales quedan bajo una
ruta con UUID imposible de adivinar y vida de 7 días. Son fotos ajenas, ya públicas en la tienda de la marca.
Descargas del staff se hacen con **GET firmado** (`getFromR2`), nunca enlazando la URL pública.

## 3. Entrega del paquete (ZIP)

**Decisión**: `GET /admin/bulk/catalog/[runId]/paquete` (route handler, `requireStaff()`), que arma el ZIP
en **streaming** con `fflate` (`Zip` + `ZipPassThrough`, sin recomprimir JPG/PNG): primero `catalogo.xlsx`
y `origen.json`, luego cada foto leída con `getFromR2`. Respuesta con `Content-Disposition: attachment`.

**Razón**: las respuestas *streaming* no están sujetas al tope de 4.5 MB de las respuestas normales de
Vercel, y la memoria queda acotada a una foto a la vez. 100 fotos desde R2 tardan segundos, dentro de
`maxDuration`.

**Riesgo y mitigación**: comportamiento del streaming en Vercel Preview → se valida en el quickstart
(escenario 3) antes del merge a `main`. Plan B ya identificado: servir el Excel y un listado de fotos y
armar el ZIP en el navegador con `fflate`, leyendo cada foto por GET firmado vía un endpoint del staff.

**Alternativas descartadas**: descargar Excel y fotos por separado (no existe "descargar carpeta");
URL prefirmada a un ZIP precalculado (habría que materializar el ZIP en R2: doble almacenamiento).

## 4. Reutilizar el script sin duplicarlo

**Decisión**: extraer a `src/lib/catalog/*` (puro TypeScript, imports **relativos**, sin `next/*`),
parametrizando lo que hoy son globales del script (`CONTACTO`, `PAUSA`, `MAX`, `ORIGIN`) y reemplazando
`die()`/`process.exit` por errores tipados. El CLI conserva sus flags y su salida por consola.

**Razón**: 802 líneas con inferencia de categoría, normalización de tallas, robots.txt y Excel; duplicarlas
garantiza divergencia. La inferencia es la fuente de las "sugerencias" (FR-018), así que debe ser la misma.

**Variación necesaria**: el vocabulario (categorías, tallas, estilos…) hoy se lee por REST con la anon key;
en el servidor se lee con el cliente de Supabase de la sesión. `vocabulary.ts` expone un tipo común y dos
cargadores.

**Verificación**: regresión del CLI (quickstart, escenario 0): misma entrada ⇒ mismas celdas en el Excel.

**Alternativas descartadas**: invocar el script como proceso hijo (no existe en serverless); reimplementar
en la app (divergencia).

## 5. Identidad de una prenda (deduplicación y comparación)

**Decisión**: `productKey(url)` = el segmento tras `/products/` en minúsculas (`/products/vestido-lino?variant=1`
⇒ `vestido-lino`); si la URL no contiene `/products/`, `host + path` en minúsculas sin barra final ni query.
La identidad es **(brand_id, productKey)**. Es la regla de FR-014 y de FR-021.

**Razón**: tolera `www.`, `http/https`, parámetros de tracking y dominios alternativos de la misma tienda;
es el `handle` estable de Shopify. Una prenda sin URL no se puede comparar y se importa con aviso.

**Costo asumido**: si la tienda cambia el handle, aparece a la vez como "ya no aparece" y "nueva"; el staff
lo resuelve en la revisión (caso límite del spec).

## 6. Cuota de almacenamiento en la subida conjunta

**Decisión**: `uploadGarmentImageAction` acepta `strict_quota=1`; entonces lee `brand_id` de la prenda **en
el servidor** y llama `uploadImageField(..., { enforceQuotaFor })`. La activan tanto la carpeta de fotos de
esta feature como el cargador de fotos sueltas de `/admin/bulk` (`pending-garments.tsx`): si no, una foto
rechazada por cuota podría subirse igual por ahí y anular FR-012 (hallazgo C2 de `/speckit-analyze`).

**Razón**: hoy el staff sube "sin bloqueo" por diseño (`UploadOptions`), pero FR-012 y el principio V
exigen respetar los 300 MB en la carga masiva. El cambio se limita a la pantalla `/admin/bulk`; las demás
subidas de staff no cambian. Con 3 subidas simultáneas la cuota puede excederse por unas pocas fotos
(aceptado en el spec).

## 7. Subida de la carpeta: orquestación en el cliente

**Decisión**: una acción crea las prendas desde el Excel y devuelve `fotos: {linea, archivo, garmentId}[]`
(de la columna `foto`). El cliente indexa los archivos de la carpeta por **nombre normalizado** (NFC,
minúsculas, solo el nombre sin ruta), empareja, y sube cada foto con `uploadGarmentImageAction` en
paralelo de 3 (patrón de `pending-garments.tsx`). Informa: emparejadas, fotos sin prenda, prendas sin foto,
rechazadas por cuota/tamaño.

**Razón**: el límite de 10 MB por acción impide enviar la carpeta entera en un `FormData`; una foto por
acción reutiliza la ruta ya probada (sharp lazy + R2 + `Blob`). Desde el punto de vista del staff es **una
sola acción** (elige Excel y carpeta, pulsa Importar).

**Detalles**: input de carpeta con `webkitdirectory` y *fallback* a selección múltiple en móviles; nombres
de archivo duplicados entre subcarpetas se reportan como ambiguos.

## 8. Vincular la importación con su corrida

**Decisión**: el Excel generado lleva una hoja `Origen (no editar)` oculta con el `runId`. Si
`importGarments` la encuentra y la corrida es de esa marca, registra en la corrida `imported_at`,
`imported_by` y los conteos (FR-015). Un Excel sin esa hoja se importa igual (FR-019) y no deja registro de
corrida (no hay consentimiento que registrar).

**Alternativas descartadas**: tabla de importaciones separada (dos historiales); exigir el `runId` (rompe FR-019).

## 9. Comparación de catálogo y `last_seen_at`

**Decisión**: al terminar la fase de armado de una corrida **en vivo, completa y sin límite de N**, se
calcula la comparación contra las prendas de la marca no archivadas y las archivadas por esta vía
(`discontinued_at is not null`):
- **siguen**: en tienda y en Icon ⇒ se actualiza `last_seen_at = now()` (y se limpia `discontinued_at` solo
  por acción explícita del staff, no aquí);
- **nuevas**: en tienda, no en Icon (ya salen en el Excel);
- **ya no aparecen**: en Icon (`pending`/`published`, con URL), no en tienda;
- **reaparecen**: archivadas por esta vía (`discontinued_at`) y de nuevo en tienda;
- **sin URL**: aparte, no comparables.

El resultado se guarda en `catalog_runs.comparison` (ids y conteos) para que sobreviva a recargas. Si
`ya no aparecen / comparables > 0.30` ⇒ `high_missing_ratio = true` (aviso + confirmación adicional).
Archivar es una acción posterior del staff; `discontinued_at` marca "archivada por la sincronización"
para poder distinguirla de un archivado manual y alimentar "reaparecen".

**Trigger**: `set_updated_at` de `garments` se reemplaza por una función que **no** cambia `updated_at`
cuando lo único que cambió es `last_seen_at` (comparación `to_jsonb(new) - cols = to_jsonb(old) - cols`).
Verificado (2026-10-30, `git grep`): ningún código de `src/` ni migración ordena ni filtra por
`garments.updated_at`; el cambio solo protege la semántica de "última edición" (FR-020).

**Alternativas descartadas**: reutilizar `updated_at` (se pisa con cualquier edición); archivar
automáticamente (rechazado por producto, SC-008); calcular la comparación al vuelo sin guardarla (pierde
el estado si se recarga).

## 10. Contacto del User-Agent

**Decisión**: el formulario pide un correo de contacto (visible para la tienda en el User-Agent, como
hace el CLI); por defecto lo toma de la variable de entorno **`CATALOG_BOT_CONTACT`** (correo del equipo),
no del correo personal de quien opera. Sin valor ni campo ⇒ no se inicia.

**Razón**: el correo de una persona del staff no debe viajar a tiendas de terceros sin que lo decida.

## 11. Pruebas

**Decisión**: no añadir una suite en esta feature. La constitución dice que añadirla es una enmienda
MINOR; se propone aparte (`node:test` + `tsx` bastarían para las funciones puras de `src/lib/catalog/`).
Mientras tanto: lint + build + quickstart + regresión del CLI.

## 12. Seguridad y consentimiento

- Todas las acciones y el route handler: `requireStaff()` (principio III).
- Consentimiento: casilla obligatoria validada **en el servidor** (`consent_confirmed` con `check (… = true)`
  en la tabla); queda en la fila y en `origen.json`.
- SSRF: la URL de la tienda se normaliza a `origin`; se rechazan hosts privados/loopback/`.local` y
  esquemas distintos de https/http; las fotos solo se descargan si su host coincide con el de la tienda
  o con `cdn.shopify.com`/`*.myshopify.com`. Las redirecciones se siguen **a mano** (`redirect: "manual"`,
  máx. 5 saltos) y cada salto revalida el host; además se resuelve el DNS del host y se rechaza si alguna
  dirección es privada, loopback o link-local.
- Respeto de la tienda: `robots.txt` antes de leer; 429/503 con reintentos limitados y corte definitivo
  (nunca se intenta esquivar el límite), igual que el script.
- El CSV subido se trata como dato no confiable (límite de 10 MB, solo columnas conocidas).
