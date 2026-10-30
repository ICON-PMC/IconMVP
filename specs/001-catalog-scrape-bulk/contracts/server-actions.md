# Contrato: acciones de servidor y ruta de descarga

Interfaz interna entre la UI de `/admin/bulk` y el servidor. Todas las acciones empiezan con
`requireStaff()` (rol `curator` o `admin`); un rol distinto redirige a `/`. Los mensajes `error` están en
español neutro. Tipos en TypeScript a modo de contrato (no son el código final).

## `startCatalogRun(formData)` · `src/app/admin/bulk/catalog/actions.ts`

Crea una corrida. No lee productos todavía, salvo el CSV (que se parsea aquí).

| Campo de `FormData` | Obligatorio | Regla |
|---|---|---|
| `brand_id` | sí | Debe existir y estar activa; la función no crea marcas (FR-002). |
| `consent` | sí | Debe valer `"on"`; si no ⇒ `error` (FR-004). Validado también por `check` en la tabla. |
| `url` | sí si no hay `csv` | Se normaliza a `origin`; solo http/https; hosts privados/loopback rechazados. |
| `csv` | no | `File` ≤ 10 MB, con columnas `Handle` y `Title`. Con `csv` la lectura en vivo no se hace. |
| `contact` | no | Correo; por defecto `CATALOG_BOT_CONTACT`. Sin ninguno ⇒ `error`. |
| `max` | no | Entero ≥ 1 (FR-007). Una corrida con `max` nunca es *completa*. |
| `skip_photos` | no | `"on"` omite fotos (FR-007). |
| `pause_ms` | no | 1000 a 10000; default 2000. |

```ts
type StartResult =
  | { ok: true; runId: string; phase: "reading" | "photos" | "building" }
  | { ok: false; error: string; hint?: "use_csv" };
```

- Con `url` **y sin `csv`**: lee `robots.txt`. Con `csv` no hay lectura en vivo, así que `robots.txt` no se consulta ni bloquea (la `url` solo arma los enlaces de compra). Si no permite `/products.json` ⇒ `{ ok:false, hint:"use_csv", error:"La tienda no permite la lectura automática. Pide a la marca el CSV de productos." }` y **no** se crea fila (Escenario 5 de la Historia 1).
- Lee `meta.json` (moneda) con la misma pausa.

## `advanceCatalogRun(runId)`

Una tanda acotada (~40 s). Idempotente; seguro de llamar desde varias pestañas (compare-and-set).

```ts
type AdvanceResult =
  | {
      ok: true;
      phase: "reading" | "photos" | "building" | "done";
      done: boolean;                 // true cuando phase === "done"
      progress: { label: string; current: number; total: number | null };
      warnings: string[];            // p. ej. "La tienda pidió frenar; se omiten las fotos restantes."
      summary?: RunSummary;          // solo cuando done: stats, tallas desconocidas, filas con avisos y `comparison`
    }
  | { ok: false; error: string; retryable: boolean };
```

Comportamiento por fase:
- `reading`: una página de `/products.json?limit=250&page=<cursor>`, tras la pausa. Termina al recibir < 250
  o al alcanzar `max`. Marca `is_complete=false` si hubo `max` o bloqueo.
- `photos`: descarga fotos desde `cursor` hasta agotar el presupuesto; sube cada original a R2 y anota
  `photo`. Pausa de 300 ms entre fotos. Si la CDN sigue pidiendo frenar ⇒ marca `blocked`, deja el resto sin foto.
- `building`: genera Excel + `origen.json`, los sube, y si `is_complete` calcula `comparison` y actualiza
  `last_seen_at` de las que siguen. Pasa a `done`.
- `retryable: true` ⇒ la UI reintenta con espera; `false` ⇒ la corrida pasa a `failed` con `error`.

## `discardCatalogRun(runId)`

Borra sus objetos R2 y la fila (o la marca `discarded` si conserva registro). `{ ok:boolean; error?:string }`.

## `importGarments(prev, formData)` (existente, ampliada) · `src/app/admin/bulk/actions.ts`

Conserva la entrada (`file` = `.xlsx`) y el formato de columnas. Cambios:

```ts
type RowResult = { line: number; title: string; ok: boolean; message?: string;
                   skipped?: "exists" };                      // NUEVO (FR-014)
type ImportResult = {
  created: number;
  skippedExisting: number;                                     // NUEVO
  results: RowResult[];
  photos: { line: number; file: string; garmentId: string }[]; // NUEVO: columna "foto" ↔ prenda creada
  runId?: string;                                              // NUEVO: si el Excel traía la hoja Origen
  error?: string;
} | null;
```

- Deduplicación: por `(brand_id, productKey(product_url))` contra la base y dentro del mismo archivo. La
  fila repetida no se inserta y se reporta `skipped:"exists"`. Filas sin URL se importan con la nota
  *"sin enlace de compra: no se puede comprobar si ya existe"*.
- Respeta lo que dice el Excel (no consulta la corrida para nada más que registrar el vínculo).
- Repite la comprobación de duplicados justo antes del INSERT para acortar la ventana de dos importaciones
  simultáneas de la misma marca (riesgo residual aceptado en el spec).
- Si el Excel está vinculado a una corrida `shop` **completa**, las prendas creadas quedan con
  `last_seen_at = finished_at` de esa corrida (FR-020).
- Si el Excel trae la hoja `Origen (no editar)` y esa corrida es de la marca de las filas: escribe
  `imported_at`, `imported_by`, `import_stats` (se completan `photos_*` al terminar la subida de fotos con
  `reportPhotoImport`).

## `uploadGarmentImageAction(formData)` (existente, ampliada)

Campo nuevo opcional `strict_quota`:
- `"1"` ⇒ lee `brand_id` de la prenda **en servidor** y sube con `enforceQuotaFor` ⇒ si excede 300 MB devuelve
  `{ ok:false, code:"quota", error: <mensaje de StorageQuotaError> }` (FR-012).
- Ausente ⇒ comportamiento actual (sin bloqueo para staff). Lo envían la carpeta de fotos **y** el cargador
  de fotos sueltas de `/admin/bulk` (`pending-garments.tsx`).
- Sin cambios: foto >10 MB o no imagen ⇒ `{ ok:false, error }`, sin cancelar el resto.

## `reportPhotoImport(runId, stats)`

`{ photos_matched, photos_unmatched, garments_without_photo }` ⇒ completa `import_stats`. Solo staff; solo si
`imported_at` ya existe en esa corrida.

## `archiveMissingAction(runId, garmentIds, confirmHighRatio?)` / `republishReappearedAction(runId, garmentIds)`

```ts
type ComparisonActionResult =
  | { ok: true; changed: number }
  | { ok: false; error: string; needsExtraConfirm?: boolean };
```

- `archiveMissingAction`: exige que cada id esté en `comparison.ya_no` de esa corrida y que la corrida sea
  completa. Si `comparison.high_missing_ratio` y no llega `confirmHighRatio=true` ⇒
  `{ ok:false, needsExtraConfirm:true }` (FR-023). Efecto: `status='archived'`, `discontinued_at=now()`;
  agrega a `actions` y quita de `ya_no`; `revalidatePath("/feed")`.
- `republishReappearedAction`: ids en `comparison.reaparecen`; si la prenda tiene foto ⇒ `status='published'`,
  `published_at=now()`, `discontinued_at=null`; si no ⇒ `status='pending'`. Registra en `actions`.
- Nunca archivan por sí solas (SC-008): son las únicas escrituras que cambian `status` en esta feature
  aparte de la subida de foto existente.

## Ruta `GET /admin/bulk/catalog/[runId]/paquete` · `route.ts`

| Aspecto | Contrato |
|---|---|
| Auth | `requireStaff()`; no staff ⇒ redirige a `/`. |
| Precondición | `phase === "done"` y no vencida; si no ⇒ `409` con texto en español. |
| Respuesta | `200`, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="<slug-marca>-catalogo.zip"`, cuerpo en **streaming**. |
| Contenido | Ver [package-format.md](./package-format.md). |
| Errores a mitad | Un objeto R2 ilegible se omite y se anota en `LEEME.txt` dentro del ZIP; no se aborta la descarga. |
| Límites | `export const maxDuration = 60`. |
