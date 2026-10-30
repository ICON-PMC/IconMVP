---

description: "Tareas de implementación: importar catálogo de una marca desde el panel de carga masiva"
---

# Tasks: Importar catálogo de una marca desde el panel de carga masiva

**Input**: `/specs/001-catalog-scrape-bulk/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md, spec.md. Constitución: `.specify/memory/constitution.md` (v1.1.0: incluye la cláusula de *artefactos temporales* del principio V, ya aplicada; viaja en el mismo PR que esta feature).

**Tests**: no se pidieron en el spec y la constitución no admite aún una suite automatizada
(`TODO(TESTS)`). La verificación de cada historia son los escenarios de [quickstart.md](./quickstart.md);
las tareas de validación manual están marcadas como tales. `npm run lint` y `npm run build` son puerta de merge.

**Organization**: por historia de usuario (US1 a US4 del spec). Rutas relativas a la raíz del repo.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias abiertas)
- **[Story]**: US1 = generar paquete · US2 = subir Excel + fotos · US3 = registro y revisión · US4 = descontinuadas

## Reglas transversales (aplican a TODAS las tareas)

- Textos de UI, errores y comentarios en **español neutro e inclusivo** (principio VII).
- Cada server action y route handler nuevo empieza con `await requireStaff()` (`src/lib/auth.ts`).
- `sharp` solo con `await import("sharp")` dentro de la función; subidas a R2 con `Blob` (`uploadToR2`).
- Los módulos de `src/lib/catalog/` usan imports **relativos** y **no** importan `next/*` ni el alias `@/`.
- Estilos con tokens de `src/app/globals.css` y componentes shadcn existentes (`src/components/ui/*`); nada de colores nuevos.
- Una migración ya aplicada **no se edita**.

---

## Phase 1: Setup

**Purpose**: dependencia, configuración y línea base para la regresión del CLI.

- [x] T001 Añadir la dependencia `fflate` a `package.json` con `npm install fflate` (fijar versión exacta con ≥ 2 semanas de antigüedad) y confirmar que `package-lock.json` cambió.
- [x] T002 [P] Añadir a `.env.example` la variable `CATALOG_BOT_CONTACT=` con un comentario en español: correo del equipo que verá cada tienda en el User-Agent; solo servidor; nunca el correo personal de quien opera.
- [x] T003 Capturar la **línea base del CLI antes de refactorizar**: en la rama actual correr `npm run catalog:excel -- --marca "<Marca>" --csv <csv-de-prueba> --url <tienda> --contacto <correo> --consentimiento --sin-fotos --salida <scratchpad>/antes` y guardar el resultado (Excel + `origen.json`) en el scratchpad para T016. Confirmar también que `npm run lint && npm run build` pasan sobre la rama sin cambios.

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: migración, tipos, helper de R2 y la librería compartida extraída del script.

**⚠️ CRITICAL**: ninguna historia empieza hasta terminar esta fase.

### Base de datos (principios III y IV)

- [x] T004 Crear `supabase/migrations/20261030000000_catalog_runs.sql` con la parte de `garments`: `alter table garments add column if not exists last_seen_at timestamptz` (nulo = "sin verificar") y `add column if not exists discontinued_at timestamptz`; **sin backfill**; reemplazar el trigger `garments_set_updated_at` por una función que conserve `updated_at` cuando `to_jsonb(new) - 'last_seen_at' - 'updated_at' = to_jsonb(old) - 'last_seen_at' - 'updated_at'` (el único cambio es `last_seen_at`) y llame al `set_updated_at` normal en cualquier otro caso. Idempotente (`if not exists`, `create or replace`, `drop trigger if exists`).
- [x] T005 En el mismo archivo `supabase/migrations/20261030000000_catalog_runs.sql` (después de T004) crear `catalog_runs` con **exactamente** las columnas de [data-model.md](./data-model.md): `id uuid pk default gen_random_uuid()`; `brand_id uuid not null references brands(id) on delete cascade`; `created_by uuid references users(id) on delete set null`; `source_kind text not null check (source_kind in ('shop','csv'))`; `origin text`; `source_label text not null`; `consent_confirmed boolean not null check (consent_confirmed)`; `contact text not null`; `options jsonb not null`; `phase text not null check (phase in ('reading','photos','building','done','failed','discarded'))`; `cursor integer not null default 0` (T017 lo fija a `1` cuando la fase inicial es `reading`); `currency text`; `products jsonb not null default '[]'` (tope 500 elementos: `check (jsonb_array_length(products) <= 500)`); `stats jsonb not null default '{}'`; `unknown_sizes jsonb not null default '{}'`; `is_complete boolean not null default false`; `comparison jsonb`; `package_keys jsonb not null default '{"xlsx":null,"origen":null,"photos":[]}'`; `imported_at timestamptz`; `imported_by uuid references users(id) on delete set null`; `import_stats jsonb`; `actions jsonb not null default '[]'`; `error text`; `expires_at timestamptz not null default now() + interval '7 days'`; `created_at`/`updated_at timestamptz not null default now()` con el trigger `set_updated_at` existente; `finished_at timestamptz`. Índices `(brand_id, created_at desc)` y `(expires_at)`. `alter table … enable row level security`; policy `catalog_runs_staff_all` `for all to authenticated using (public.is_staff()) with check (public.is_staff())`; `grant select, insert, update, delete on catalog_runs to authenticated` y `grant all … to service_role`; **ningún GRANT a `anon`**.
- [x] T006 Actualizar a mano `src/lib/database.types.ts` en el mismo commit: añadir `last_seen_at: string | null` y `discontinued_at: string | null` a `garments` (Row/Insert/Update, opcionales en Insert/Update) y la tabla `catalog_runs` (Row/Insert/Update/Relationships) con los tipos de T005. Depende de T004, T005.
- [x] T007 Verificar la migración en local: `supabase db reset`; comprobar con `docker exec -i supabase_db_Icon psql -U postgres -d postgres` que (a) `update garments set last_seen_at = now()` **no** cambia `updated_at`, mientras que cambiar `title` sí lo cambia; (b) un rol `anon` obtiene `permission denied for table catalog_runs`; (c) insertar `catalog_runs` con `consent_confirmed=false` falla. Depende de T004, T005.

### R2 y librería compartida

- [x] T008 [P] En `src/lib/r2.ts` añadir `getFromR2(key): Promise<Response | null>` con GET firmado (mismo `r2Config()` y `AwsV4Signer`/aws4fetch que `uploadToR2`); devuelve `null` si el objeto no existe (404) y lanza para otros errores. Conservar el estilo y los mensajes en español del archivo.
- [x] T009 Crear `src/lib/catalog/infer.ts` extrayendo de `scripts/catalog-to-excel.ts` las funciones `norm`, `slug`, `htmlToText`, `inferCategory`, `matchTags`, `normalizeSizes`, la constante `MAX_TAGS_PER_TYPE` y los tipos que usan; **sin cambiar su comportamiento**. Importar solo tipos de `./vocabulary` (**depende de T012**).
- [x] T010 [P] Crear `src/lib/catalog/http.ts` con `BloqueadoError`, `politeFetch(url, { userAgent, tries = 4, timeoutMs = 30000 })` (misma lógica de 429/503, `retry-after`, espera máx. 60 s, nunca esquiva el límite), `parseRobots`, `robotsAllows(groups, path)` (agente `iconcatalogbot`), `buildUserAgent(contact)` (`IconCatalogBot/1.0 (+<contacto>; importación con consentimiento de la marca)`), y la guarda SSRF `assertPublicHttpUrl(url)` que rechaza esquemas distintos de http/https, `localhost`, IPs privadas/loopback/link-local y hostnames `.local`/`.internal`, más `isAllowedPhotoHost(photoUrl, shopOrigin)` (mismo host de la tienda, `cdn.shopify.com` o `*.myshopify.com`). `politeFetch` sigue las redirecciones **a mano** (`redirect: "manual"`, máx. 5 saltos) y revalida cada salto con `assertPublicHttpUrl`; `assertPublicHttpUrl` además resuelve el DNS (`node:dns/promises`) y rechaza el host si alguna dirección es privada, loopback o link-local. Sin `process.exit` ni `console`.
- [x] T011 [P] Crear `src/lib/catalog/product-key.ts` con `productKey(url: string | null | undefined): string | null` según [research.md §5](./research.md): segmento tras `/products/` en minúsculas (decodificado, sin query/hash/barra final); si no hay `/products/`, `host + path` en minúsculas sin barra final ni query; `null` si la URL es vacía o inválida.
- [x] T012 [P] Crear `src/lib/catalog/vocabulary.ts` con el tipo `Vocabulary` (marcas, categorías, tallas, estilos, ocasiones, climas, `source`), `FALLBACK_VOCABULARY`, `loadVocabularyRest(env)` (el cargador por REST con anon key que hoy usa el script) y `loadVocabularyFromSupabase(client)` (cliente de `@supabase/supabase-js` ya autenticado, para el servidor, tipado estructuralmente para no importar `@/`). Mismos nombres exactos que acepta el importador.
- [x] T013 Crear `src/lib/catalog/shopify.ts` con el tipo `Product` (ver forma en data-model.md, campo `image_url`), `fromShopifyJson`, `fetchProductsPage(origin, page, { userAgent, pauseMs })` (devuelve `{ products, rawCount }`; una sola página por llamada), `fetchShopMeta(origin, ctx)` (moneda), `checkRobots(origin, ctx)` (usa `robotsAllows` sobre `/products.json`), `parseCsv(text)` y `fromCsvText(text)` (solo `Status = active`, columnas `Handle`/`Title` obligatorias; lanza `Error` en español si faltan). Depende de T009, T010.
- [x] T014 Crear `src/lib/catalog/workbook.ts` con `buildWorkbook({ brandName, products, vocab, origin, currency, run? })` → `{ workbook, stats, unknownSizes }`: la hoja `Prendas` con **las mismas 14 columnas y orden** (`marca · titulo · descripcion · precio_cop · url_producto · color · tela · categoria · tallas · estilo · ocasion · clima · foto · revisar`), la hoja `Referencia (no editar)`, las validaciones de lista y las notas de encabezado actuales; añadir la nota *"Sugerido automáticamente; revísalo antes de importar."* en los encabezados `categoria`, `estilo`, `ocasion`, `clima` (FR-018); si recibe `run`, añadir la hoja **oculta** (`state: "hidden"`) `Origen (no editar)` con `A1="run_id"/B1=<uuid>`, `A2="marca_id"/B2=<uuid>`, `A3="generado"/B3=<ISO8601>` ([package-format.md](./contracts/package-format.md)). La columna `foto` sale de `product.photo?.file`. `precio_cop` entero redondeado. Depende de T009, T012.
- [x] T015 Reescribir `scripts/catalog-to-excel.ts` como CLI delgado sobre `src/lib/catalog/*`: conserva todos los flags (`--marca --csv --url --consentimiento --contacto --pausa --max --sin-fotos --salida --ayuda`), la salida por consola, `die()`/códigos de salida, la escritura de `catalogo.xlsx`, `fotos/` y `origen.json` (campos existentes sin cambios). Imports **relativos** a `../src/lib/catalog/*`. Depende de T009–T014.
- [x] T016 Regresión del CLI ([quickstart.md Escenario 0](./quickstart.md)): correr el mismo comando de T003 con `--salida <scratchpad>/despues` y comparar celda por celda la hoja `Prendas` con la de `antes` (script `tsx` desechable en el scratchpad); confirmar que `origen.json` conserva los campos previos; `npm run lint` limpio. Depende de T015, T003.

**Checkpoint**: migración verificada en local, tipos al día, librería compartida y CLI sin regresión.

---

## Phase 3: User Story 1 — Preparar el catálogo de una marca sin terminal (Priority: P1) 🎯 MVP

**Goal**: desde `/admin/bulk` elegir marca, fuente y consentimiento, ver el avance y descargar un paquete (Excel + fotos); no se crea ninguna prenda (FR-001 a FR-009, FR-017, FR-018).

**Independent Test**: [Escenarios 1, 2 y 3 del quickstart](./quickstart.md). Una persona de staff, sin terminal, obtiene el `.zip` completo desde la URL de una tienda; `select count(*) from garments` no cambia.

### Implementation

- [x] T017 [US1] Crear `src/lib/catalog-runs.ts` (servidor; importa `@/lib/supabase/server`, `@/lib/r2`, `./catalog/*` por ruta relativa o alias) con `createRun(input)`: valida marca existente y `is_active`; **consentimiento obligatorio**; `url` obligatoria si no hay CSV; normaliza a `origin` y llama `assertPublicHttpUrl`; con `url` **y sin CSV** ejecuta `checkRobots` (con CSV no hay lectura en vivo: no se consulta `robots.txt`) y, si no permite `/products.json`, devuelve `{ ok:false, hint:"use_csv" }` **sin crear fila**; `fetchShopMeta` para la moneda; con CSV parsea (`fromCsvText`, ≤ 10 MB) y guarda `products` (tope 500, avisar si se recorta); inserta la fila con `phase` `reading` (cursor `1`) o `photos`/`building` (cursor `0`) según corresponda, `source_label` (`<origin>/products.json` o `csv:<archivo>`), `options` `{max, skip_photos, pause_ms}`. Validaciones: `max` entero ≥ 1; `pause_ms` entre 1000 y 10000 (default 2000); `contact` por defecto `process.env.CATALOG_BOT_CONTACT`, error en español si no hay ninguno.
- [x] T018 [US1] En `src/lib/catalog-runs.ts` implementar el paso `reading` de `advanceRun(runId)`: una página de `/products.json?limit=250&page=<cursor>` tras la pausa; deduplicar por `handle`; terminar al recibir < 250 o al alcanzar `max` (recortar a `max`); sin productos ⇒ `failed` con mensaje "No se encontraron productos."; `is_complete=false` si hubo `max`; pasar a `photos` (o `building` si `skip_photos`). Actualización con **compare-and-set** sobre `(id, phase, cursor)`; si no coincide, devolver el estado actual sin error. Depende de T017.
- [x] T019 [US1] En `src/lib/catalog-runs.ts` implementar el paso `photos`: desde `cursor`, mientras queden productos y no se agote el presupuesto de ~40 s: descargar `imageDownloadUrl(image_url)` (ancho 2000 en `cdn.shopify.com`) con `politeFetch`, verificar `isAllowedPhotoHost`, subir el original con `uploadToR2` (`Blob`) a `catalog-runs/<runId>/fotos/<NNN>-<slug-50>.<ext>` (esquema de nombre del CLI; es un *artefacto temporal* amparado por la cláusula del principio V de la constitución v1.1.0: no se sirve al público, no cuenta contra la cuota y vence a los 7 días), anotar `photo {file, bytes, status}` y la clave en `package_keys.photos`, `await sleep(300)` entre fotos; producto sin foto ⇒ `status:"missing"` + nota "la tienda no trae foto"; error puntual ⇒ `failed` + nota "foto no descargada"; `BloqueadoError` ⇒ `blocked` para el resto, `is_complete=false`, advertencia "La tienda pidió frenar; se omiten las fotos restantes."; nota "foto > 10 MB: el panel la rechazará, reduce su tamaño" si `bytes > 9.5 MB`. Avanza `cursor` con compare-and-set y renueva `expires_at = now() + 7 days`. Depende de T018.
- [x] T020 [US1] En `src/lib/catalog-runs.ts` implementar el paso `building`: cargar vocabulario con `loadVocabularyFromSupabase`, `buildWorkbook` con `run` (hoja Origen), subir `catalogo.xlsx` y `origen.json` (campos de [package-format.md](./contracts/package-format.md)) a `catalog-runs/<runId>/`, guardar `stats`, `unknown_sizes`, `package_keys`, `finished_at`, `phase='done'`. Depende de T019.
- [x] T021 [US1] En `src/lib/catalog-runs.ts` implementar `discardRun(runId)`: borrar con `deleteFromR2` los objetos de `package_keys`, y borrar la fila (o marcarla `discarded` si ya tiene `imported_at` o `actions` no vacías, por ser registro de procedencia). Depende de T017.
- [x] T022 [US1] Crear `src/app/admin/bulk/catalog/actions.ts` (`"use server"`) con `startCatalogRun`, `advanceCatalogRun` y `discardCatalogRun` según [contracts/server-actions.md](./contracts/server-actions.md): `requireStaff()`, lectura de `FormData` (`brand_id`, `consent` = `"on"`, `url`, `csv`, `contact`, `max`, `skip_photos`, `pause_ms`), resultados tipados `StartResult`/`AdvanceResult`, errores en español, `retryable` para fallos transitorios. Depende de T017–T021.
- [x] T023 [P] [US1] Crear `src/app/admin/bulk/catalog/[runId]/paquete/route.ts` (`export const maxDuration = 60`): `requireStaff()`; `409` en español si la corrida no está `done` o venció; respuesta `application/zip` en **streaming** con `fflate` (`Zip` + `ZipPassThrough`, método *store*), `Content-Disposition: attachment; filename="<slug-marca>-catalogo.zip"`, estructura `<slug-marca>/{catalogo.xlsx, origen.json, fotos/*, LEEME.txt}`; leer cada objeto con `getFromR2` de uno en uno; objeto ilegible ⇒ omitir y anotarlo en `LEEME.txt` sin abortar. Depende de T008, T020.
- [x] T024 [P] [US1] Crear `src/app/admin/bulk/catalog/run-form.tsx` (cliente): selector de marca activa, fuente (URL de la tienda y/o CSV), casilla de **consentimiento** con el texto "La marca autorizó el uso de su catálogo y de sus fotos", opciones avanzadas (correo de contacto, límite de N prendas, "no descargar fotos", pausa), mensajes de error y la sugerencia de usar el CSV cuando `hint:"use_csv"`. Usar componentes de `src/components/ui/*` y `GlassCard`. Depende de T022.
- [x] T025 [US1] Crear `src/app/admin/bulk/catalog/run-progress.tsx` (cliente): bucle que llama a `advanceCatalogRun` hasta `done`, con barra y etiqueta de fase ("Leyendo catálogo… / Descargando fotos 12 de 87 / Armando el Excel…"), manejo de `retryable` con espera, botón **Descargar paquete** (enlace a la ruta de T023), aviso fijo "Etiquetas sugeridas automáticamente: revisa categoría, color, estilo, ocasión y clima en el Excel antes de importar" (FR-018), y para corridas interrumpidas los botones **Continuar** / **Empezar de nuevo** (llama `discardCatalogRun` y abre el formulario). `sonner` para avisos. Al terminar (FR-008) mostrar un **resumen en pantalla** con total de prendas, fotos obtenidas, avisos por tipo (`stats`: sin categoría, sin talla, sin precio, sin foto), `unknown_sizes` y la lista de prendas con notas (`products[].notes`) con su motivo. Depende de T022, T023.
- [x] T026 [US1] Editar `src/app/admin/bulk/page.tsx`: añadir `export const maxDuration = 60`; nueva sección superior "Leer catálogo de una tienda" con `RunForm` y `RunProgress`; consultar las corridas retomables (`phase in ('reading','photos','building')` y no vencidas) del staff para mostrar el banner de reanudación; reenumerar los títulos de los pasos existentes. Depende de T024, T025.
- [ ] T027 [US1] **Validación manual** _(parcial, 2026-10-30: motor, ZIP en streaming y SSR de la sección verificados contra Supabase local + tienda y R2 falsos —22 fotos, reanudación, 2 pestañas, CSV sin tocar robots, descarte, vencimiento—; **pendiente**: clic real en la UI del navegador y el Escenario 3 en un Preview de Vercel)_  — ejecutar los Escenarios 1, 2 y 3 de [quickstart.md](./quickstart.md) (el 3 en un Preview de Vercel) y anotar los resultados en el PR. Depende de T026.

**Checkpoint**: US1 completa y demostrable de forma aislada (MVP).

---

## Phase 4: User Story 2 — Subir el Excel y las fotos de una sola vez (Priority: P1)

**Goal**: elegir Excel + carpeta de fotos en una acción; crear prendas `pending` sin duplicados, emparejar fotos por la columna `foto`, publicar las que quedan con foto y reportar lo no emparejado (FR-010 a FR-014, FR-019).

**Independent Test**: [Escenario 4 del quickstart](./quickstart.md) con un Excel de 20 prendas y 20 fotos; funciona también con un Excel ajeno (sin hoja Origen).

### Implementation

- [x] T028 [US2] Editar `importGarments` en `src/app/admin/bulk/actions.ts`: (a) **deduplicación** por `(brand_id, productKey(product_url))` contra las prendas existentes (todos los estados) de las marcas del archivo y dentro del mismo archivo; la fila repetida no se inserta y se reporta con `skipped: "exists"` y mensaje "ya existe"; filas sin `product_url` se importan con la nota "sin enlace de compra: no se puede comprobar si ya existe"; (b) leer la columna `foto` y devolver `photos: { line, file, garmentId }[]` solo de las filas creadas; (c) ampliar `ImportResult` con `skippedExisting`, `photos` y `runId` según [contracts/server-actions.md](./contracts/server-actions.md); (d) **respetar lo que dice el Excel** (no consultar la corrida para datos); (e) repetir la comprobación de duplicados **inmediatamente antes del INSERT** para acortar la ventana de dos importaciones simultáneas de la misma marca (el duplicado residual es un riesgo aceptado en el spec, Supuestos). Mantener nombres de columnas y mensajes actuales. Depende de T011.
- [x] T029 [US2] Editar `uploadGarmentImageAction` en `src/app/admin/bulk/actions.ts`: campo opcional `strict_quota`; si vale `"1"`, leer `brand_id` de la prenda **en el servidor** y llamar `uploadImageField(formData, …, "image", { enforceQuotaFor: brandId })`; capturar `StorageQuotaError` y devolver `{ ok:false, code:"quota", error: <mensaje> }` (FR-012); sin el campo, comportamiento actual sin bloqueo. Ampliar el tipo `ActionResult` con `code?: "quota"`. Depende de T028 (mismo archivo).
- [x] T030 [P] [US2] Crear `src/app/admin/bulk/photo-matching.ts` (módulo puro, sin React): `normalizeFileName(name)` (Unicode NFC, minúsculas, solo el nombre sin ruta) y `matchPhotos(files, expected)` → `{ matched: {file, garmentId, line}[], filesWithoutGarment: File[], garmentsWithoutFile: {line, garmentId, expectedFile}[], ambiguous: string[] }`; dos archivos con el mismo nombre normalizado ⇒ `ambiguous` y no se emparejan.
- [x] T031 [US2] Crear `src/app/admin/bulk/import-package-form.tsx` (cliente) que reemplaza a `import-form.tsx`: un solo formulario con el `.xlsx` y la carpeta (`<input type="file" webkitdirectory multiple>` con *fallback* a selección múltiple de archivos), botón **Importar**; orquesta (1) `importGarments`, (2) `matchPhotos`, (3) subida de cada foto con `uploadGarmentImageAction` (`strict_quota=1`, **3 en paralelo**, tope 10 MB por archivo igual que `pending-garments.tsx`), con progreso, errores por foto (cuota, tamaño, no imagen) sin cancelar el resto, y (4) resumen: prendas creadas / ya existían / fotos subidas / fotos sin prenda / prendas sin foto / rechazadas por cuota, con el detalle por fila de `results`. Depende de T028–T030.
- [x] T032 [US2] Editar `src/app/admin/bulk/page.tsx`: sustituir `ImportForm` por `ImportPackageForm`, actualizar los textos de los pasos ("Subir Excel y carpeta de fotos") y mantener `PendingGarments` para las prendas que queden sin foto; **editar `src/app/admin/bulk/pending-garments.tsx` para que cada subida envíe `strict_quota=1` y muestre el mensaje de cuota (`code:"quota"`) en la tarjeta de la prenda** (si no, una foto rechazada por cuota se podría subir por ahí y anular FR-012); borrar `src/app/admin/bulk/import-form.tsx`. Depende de T031.
- [ ] T033 [US2] **Validación manual** _(parcial, 2026-10-30: ejecutadas las server actions reales contra Supabase local + R2 falso —duplicados en archivo y contra la base, filas sin enlace, reimportación, mapa foto→prenda, emparejado por nombre con orden distinto, archivos no imagen, nombres ambiguos, publicación al subir foto, cuota con y sin `strict_quota`—; **pendiente**: clic real en el formulario de carpeta, foto > 10 MB en el navegador y cuota con el cargador suelto desde la UI)_  — Escenario 4 de [quickstart.md](./quickstart.md), puntos 1 a 7 y 9 (incluye cuota —también al reintentar desde el cargador suelto—, foto > 10 MB, Excel ajeno y que el almacén temporal no consume los 300 MB). Depende de T032.

**Checkpoint**: US1 y US2 funcionan juntas y por separado.

---

## Phase 5: User Story 3 — Registro de procedencia y revisión posterior (Priority: P2)

**Goal**: cada corrida deja registro consultable (responsable, fecha, marca, fuente, consentimiento, conteos) y la importación queda vinculada; las corridas vencidas se purgan (FR-015, SC-004, supuesto de 7 días).

**Independent Test**: [Escenarios 4.8 y 6 del quickstart](./quickstart.md): tras una importación, el historial muestra los datos de procedencia y la corrida vencida desaparece junto con sus objetos R2.

### Implementation

- [x] T034 [US3] En `importGarments` (`src/app/admin/bulk/actions.ts`): si el Excel trae la hoja `Origen (no editar)`, leer `run_id`/`marca_id`; si la corrida existe y es de la marca de las filas creadas, escribir `imported_at`, `imported_by` e `import_stats` (`created`, `skipped_existing`) y devolver `runId`. Si esa corrida es `source_kind='shop'` y `is_complete=true`, fijar además `last_seen_at = finished_at` de la corrida en las prendas recién creadas (FR-020: no deben figurar "sin verificar"); con CSV o lectura parcial se dejan en `null`. Un Excel sin esa hoja se importa igual y no escribe nada (FR-019). Depende de T028.
- [x] T035 [US3] Añadir la acción `reportPhotoImport(runId, stats)` en `src/app/admin/bulk/catalog/actions.ts` (`requireStaff()`; solo si la corrida ya tiene `imported_at`; completa `import_stats` con `photos_matched`, `photos_unmatched`, `garments_without_photo`) y llamarla desde `src/app/admin/bulk/import-package-form.tsx` al terminar la subida de fotos. Depende de T031, T034.
- [x] T036 [P] [US3] Implementar `purgeExpiredRuns()` en `src/lib/catalog-runs.ts`: seleccionar corridas con `expires_at < now()` y fase distinta de `discarded`; borrar sus objetos R2 (`deleteFromR2`) y la fila, o marcarla `discarded` si tiene `imported_at` o `actions` no vacías. Debe ser tolerante a fallos de R2 (log y continuar). Depende de T021.
- [x] T037 [P] [US3] Crear `src/app/admin/bulk/catalog/runs-list.tsx`: historial por marca (más recientes primero) con responsable, fecha, marca, fuente (tienda/CSV), "consentimiento confirmado", conteos de prendas/fotos, estado, y si hubo importación (fecha e `import_stats`) y acciones de archivado/republicación; enlace a "Descargar paquete" mientras no haya vencido. Texto en español y tokens existentes.
- [x] T038 [US3] Editar `src/app/admin/bulk/page.tsx`: llamar `purgeExpiredRuns()` al cargar (sin bloquear el render si falla) y mostrar `RunsList` bajo las secciones de carga. Depende de T036, T037.
- [x] T039 [US3] **Validación manual** — Escenarios 4.8 y 6 de [quickstart.md](./quickstart.md), y confirmar SC-004: toda corrida tiene fila con responsable, fecha, marca, fuente y consentimiento. Depende de T038.

**Checkpoint**: la procedencia es trazable de punta a punta.

---

## Phase 6: User Story 4 — Detectar prendas que la marca ya no vende (Priority: P2)

**Goal**: tras una lectura en vivo completa, mostrar siguen / nuevas / ya no aparecen / reaparecen y dejar que el staff archive (FR-020 a FR-024).

**Independent Test**: [Escenario 5 del quickstart](./quickstart.md). Una prenda cuyo enlace ya no está en la tienda aparece en "ya no aparecen" y, al confirmar, sale del feed; con `max`, CSV o lectura incompleta no hay comparación.

### Implementation

- [x] T040 [US4] En `src/lib/catalog-runs.ts` añadir `computeComparison(run)` y llamarla al final del paso `building` (T020) **solo si** `source_kind='shop'`, `is_complete=true` y la corrida no tiene `max`: leer las prendas de la marca (`pending`/`published`, y las archivadas con `discontinued_at not null`), calcular grupos por `(brand_id, productKey)`: `siguen`, `nuevas`, `ya_no`, `reaparecen`, `sin_url`; `comparable` = prendas con URL; `high_missing_ratio = (ya_no / comparable) > 0.30`; guardar el JSON de [data-model.md](./data-model.md) en `comparison` y actualizar `last_seen_at = now()` **en lote** solo de las que siguen. Con lecturas parciales, CSV o Excel subido: no calcular ni actualizar nada (FR-022). Depende de T011, T020.
- [x] T041 [US4] Añadir en `src/app/admin/bulk/catalog/actions.ts` las acciones `archiveMissingAction(runId, garmentIds, confirmHighRatio?)` y `republishReappearedAction(runId, garmentIds)` según [contracts/server-actions.md](./contracts/server-actions.md): `requireStaff()`; cada id debe estar en `comparison.ya_no` / `comparison.reaparecen` de esa corrida y la corrida debe ser completa; si `high_missing_ratio` y no llega `confirmHighRatio=true` ⇒ `{ ok:false, needsExtraConfirm:true }`; archivar ⇒ `status='archived'`, `discontinued_at=now()`; republicar ⇒ `status='published'`, `published_at=now()`, `discontinued_at=null` si la prenda tiene foto, si no `status='pending'`; agregar a `actions` (`{type, at, by, garment_ids}`, FR-024), quitar las ids resueltas del grupo y `revalidatePath("/feed")` y `/admin/bulk`. **Nunca** archivar automáticamente (SC-008). Depende de T040.
- [x] T042 [P] [US4] Crear `src/app/admin/bulk/catalog/comparison-panel.tsx` (cliente): cuatro grupos con contador y listas (casillas por prenda en "ya no aparecen" y "reaparecen"; "nuevas" y "sin enlace" solo informativas), botones **Archivar seleccionadas** / **Volver a publicar**, aviso destacado si `high_missing_ratio` ("Más del 30 % del catálogo no apareció: podría ser un fallo de lectura") y diálogo de confirmación adicional con `src/components/confirm-dialog.tsx`; mostrar "sin verificar" para prendas con `last_seen_at` nulo. Depende de T041.
- [x] T043 [US4] Integrar `ComparisonPanel` en `src/app/admin/bulk/catalog/run-progress.tsx` y en `runs-list.tsx` (visible mientras la corrida esté `done` con `comparison`), y refrescar la vista tras cada acción. Depende de T042, T025, T037.
- [ ] T044 [US4] **Validación manual** _(parcial, 2026-10-30: motor y server actions reales contra Supabase local + tienda y R2 falsos —grupos siguen/nuevas/ya no aparecen/reaparecen/sin enlace, `last_seen_at` sin tocar `updated_at`, archivar solo lo elegido, bitácora con responsable, lecturas parciales y CSV sin comparación, republicar con foto, umbral del 30 % con confirmación adicional, SC-008—; SSR del panel verificado; **pendiente**: clic real en el panel del navegador)_  — Escenario 5 de [quickstart.md](./quickstart.md) completo (5.1 a 5.6), verificando que `updated_at` de las prendas que siguen **no cambia** y que `discontinued_at` solo crece por acciones explícitas (SC-008). Depende de T043.

**Checkpoint**: las cuatro historias funcionan de forma independiente.

---

## Phase 7: Polish & Cross-Cutting

- [x] T045 [P] Actualizar `docs/importar-catalogo.md` con la sección "Desde el panel de administración": flujo completo (leer tienda → descargar paquete → revisar Excel → subir Excel + carpeta → comparar), qué significan las etiquetas sugeridas, la comparación de descontinuadas y que el CLI sigue disponible.
- [x] T046 [P] Actualizar `HANDOFF.md` y `TODO.md`: variable `CATALOG_BOT_CONTACT`, orden de despliegue (migración a la nube **antes** del código), regla de ciclo de vida de R2 de 7 días sobre `catalog-runs/`, Plan B del ZIP (research §3), y marcar la feature en "Hecho" con la fecha.
- [x] T047 Revisión de seguridad (principios III y V): confirmar que **cada** acción y la ruta de `paquete` llaman `requireStaff()`; que no se usa `SUPABASE_SERVICE_ROLE_KEY` en el código de la app; que `assertPublicHttpUrl` (con resolución DNS) y `isAllowedPhotoHost` se aplican antes de toda petición saliente y en cada redirección; que ningún log imprime el correo de contacto ni URLs con credenciales; que `sharp` solo se importa de forma lazy.
- [x] T048 Correr `npm run lint` y `npm run build` y corregir lo que aparezca; confirmar que `next.config.ts` no necesita cambios (`outputFileTracingIncludes` de `/admin/bulk` ya cubre `sharp` para la subida final).
- [ ] T049 **Despliegue (manual, la dueña del proyecto)**: aplicar `20261030000000_catalog_runs.sql` a Supabase cloud (SQL Editor o MCP) **antes** de mergear; añadir `CATALOG_BOT_CONTACT` en Vercel (Preview y Production) y redeploy; crear la regla de ciclo de vida de R2 (7 días, prefijo `catalog-runs/`); correr en el Preview los Escenarios 1, 3, 4 y 5. Depende de T048.
- [ ] T050 Ejecutar el [quickstart.md](./quickstart.md) completo y la tabla "Criterios de salida" (SC-001 a SC-008), incluida la revisión a 375 px de ancho de las pantallas nuevas (principio VI) y el smoke test de release de la constitución; registrar resultados y desvíos en el PR. Depende de T044, T049.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: sin dependencias.
- **Foundational (2)**: depende de Setup; **bloquea** las historias. Internamente: `T004 → T005 → T006/T007`; `T008, T010, T011, T012` en paralelo; `T009` tras `T012`; `T013` tras `T009/T010`; `T014` tras `T009/T012`; `T015` tras `T009–T014`; `T016` tras `T015` y `T003`.
- **US1 (3)**: depende de Foundational. **US2 (4)**: depende de Foundational y de `T011`; **no** depende de US1 (también acepta Excel ajeno). **US3 (5)**: depende de US1 (corridas, `T021`) y de US2 (`T028`, `T031`). **US4 (6)**: depende de US1 (`T020`, `T025`) y de US3 (`T037`) solo para la integración visual.
- **Polish (7)**: tras las historias deseadas; `T049` y `T050` al final.

### Dentro de cada historia

- Servidor (`catalog-runs.ts` / acciones) antes de la UI que lo usa; ruta de descarga y formulario en paralelo; la validación manual al cierre.
- `src/app/admin/bulk/page.tsx` lo editan `T026`, `T032`, `T038` y `T043`/`T044`: hacerlo **en serie**, no en paralelo.
- `src/app/admin/bulk/actions.ts` lo editan `T028`, `T029`, `T034`: en serie.
- `src/lib/catalog-runs.ts` lo editan `T017–T021`, `T036`, `T040`: en serie.

### Dependencias entre historias

```text
Foundational ──┬─▶ US1 (P1, MVP) ──┬─▶ US3 (P2) ──┐
               │                    └──────────────┼─▶ US4 (P2)
               └─▶ US2 (P1) ────────▶ US3 ──────────┘
```

## Parallel Opportunities

- **Setup**: `T002` en paralelo con `T001`.
- **Foundational**: `T008, T010, T011, T012` a la vez (archivos distintos); luego `T009`; después `T013` y `T014` en paralelo entre sí.
- **US1**: `T023` (ruta ZIP) y `T024` (formulario) en paralelo tras `T020`/`T022`.
- **US2**: `T030` (emparejado puro) en paralelo con `T028`.
- **US3**: `T036` y `T037` en paralelo.
- **US2 con US1**: un segundo desarrollador puede tomar US2 completa (`T028–T033`) mientras el primero hace US1, tras el checkpoint de Foundational.

### Ejemplo: Foundational en paralelo

```text
Task: "getFromR2 en src/lib/r2.ts"                                  (T008)
Task: "src/lib/catalog/http.ts"                                     (T010)
Task: "src/lib/catalog/product-key.ts"                              (T011)
Task: "src/lib/catalog/vocabulary.ts"                               (T012)
```

## Implementation Strategy

### MVP primero (US1)

1. Setup (T001–T003) → Foundational (T004–T016).
2. US1 (T017–T027). **Parar y validar**: un staff obtiene el `.zip` sin terminal; nada se crea en Icon.
3. Con solo esto ya se elimina el paso de terminal; el Excel y las fotos se suben con el flujo manual existente.

### Entrega incremental

1. Foundational listo.
2. + US1 → demo (MVP).
3. + US2 → "subir Excel + carpeta de una vez" (ya se puede cargar un catálogo de punta a punta).
4. + US3 → trazabilidad y limpieza.
5. + US4 → descontinuadas. Cada paso aporta valor sin romper el anterior.

### Riesgos a vigilar durante la implementación

- **Streaming del ZIP en Vercel** (T023/T027): validar en Preview antes de seguir confiando en el diseño; Plan B en research §3.
- **Regresión del CLI** (T016): no seguir con US1 si las celdas del Excel difieren.
- **Migración antes del código** (T049): sin ella el Preview falla contra un esquema inexistente.

## Notes

- 50 tareas: Setup 3 · Foundational 13 · US1 11 · US2 6 · US3 6 · US4 5 · Polish 6.
- `[P]` = archivos distintos y sin dependencias abiertas; las tareas de validación manual no llevan `[P]`.
- Commits sugeridos: uno por tarea o por grupo lógico (migración + tipos juntos, constitución IV).
- No hay tareas de tests automatizados: ver nota de **Tests** arriba y [research.md §11](./research.md).
