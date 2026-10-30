# Data Model: Importar catálogo desde el panel de carga masiva

Fuente de verdad del esquema final: `supabase/migrations/20261030000000_catalog_runs.sql` (a crear).
`src/lib/database.types.ts` se actualiza a mano en el mismo commit.

## Cambios en `garments`

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `last_seen_at` | `timestamptz` | sí | Última lectura **completa** de la tienda en que la prenda apareció (también se fija al crear la prenda desde el paquete de una lectura completa). `null` = "sin verificar" (FR-020). |
| `discontinued_at` | `timestamptz` | sí | Cuándo la archivó el staff desde la comparación (“ya no aparece”). `null` si no se archivó por esta vía o si se volvió a publicar. Permite el grupo “reaparecen”. |

- Sin backfill: todas las prendas existentes quedan en `null` ("sin verificar").
- **Trigger**: `garments_set_updated_at` pasa a una función que conserva `updated_at` cuando el único
  cambio es `last_seen_at`. `discontinued_at` sí cuenta como edición. La comparación excluye también
  `search_text`: es una columna generada y en un trigger `BEFORE` todavía no está calculada en `NEW`.
- Sin índices nuevos: las consultas filtran por `brand_id` (índice existente).
- RLS y GRANT: ya cubiertos a nivel de tabla (`garments_staff_all`); las columnas nuevas los heredan.

## Tabla nueva `catalog_runs`

Una fila por corrida de lectura de catálogo (FR-015). Doble función: estado reanudable y registro.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()`; también es el prefijo R2 (`catalog-runs/<id>/`). |
| `brand_id` | `uuid` FK `brands(id)` | no | `on delete cascade`. |
| `created_by` | `uuid` FK `users(id)` | sí | `on delete set null`. Responsable. |
| `source_kind` | `text` | no | `'shop'` (lectura en vivo) o `'csv'`. Check. |
| `origin` | `text` | sí | Origen de la tienda (`https://tienda.com`); obligatorio si `shop`, opcional con `csv`. |
| `source_label` | `text` | no | `https://tienda.com/products.json` o `csv:archivo.csv` (lo que va en `origen.json`). |
| `consent_confirmed` | `boolean` | no | `check (consent_confirmed)`: no se puede crear sin consentimiento. |
| `contact` | `text` | no | Correo de contacto usado en el User-Agent. |
| `options` | `jsonb` | no | `{ max: number\|null, skip_photos: boolean, pause_ms: number }`. |
| `phase` | `text` | no | `reading` → `photos` → `building` → `done`; también `failed`, `discarded`. Check. |
| `cursor` | `integer` | no | `reading`: siguiente página (1-based). `photos`: índice del siguiente producto. `default 0`; al crear la corrida se fija a `1` si la fase inicial es `reading`. |
| `currency` | `text` | sí | Moneda reportada por la tienda. |
| `products` | `jsonb` | no | Arreglo de productos leídos (ver abajo). Tope 500. |
| `stats` | `jsonb` | no | Conteos: `{ products, photos, no_photo, no_category, no_size, no_price, with_style, with_occasion, with_climate }`. |
| `unknown_sizes` | `jsonb` | no | `{ "<talla>": n }` tallas de la tienda que Icon no reconoce. |
| `is_complete` | `boolean` | no | `true` solo si: `shop`, todas las páginas de `/products.json` leídas y sin `max` ni tope de 500. Un bloqueo de la CDN de fotos no lo afecta (el listado sigue completo). Habilita la comparación. |
| `comparison` | `jsonb` | sí | Resultado de la comparación (ver abajo); `null` si no aplica. |
| `package_keys` | `jsonb` | no | Claves R2: `{ xlsx, origen, photos: string[] }`. |
| `imported_at` | `timestamptz` | sí | Cuándo se subió el Excel de esta corrida (FR-015). |
| `imported_by` | `uuid` FK `users(id)` | sí | `on delete set null`. |
| `import_stats` | `jsonb` | sí | `{ created, skipped_existing, photos_matched, photos_unmatched, garments_without_photo }`. |
| `actions` | `jsonb` | no | Bitácora (FR-024): `[{ type: 'archive'\|'republish', at, by, garment_ids[] }]`. Default `[]`. |
| `error` | `text` | sí | Mensaje legible si `phase = 'failed'`. |
| `expires_at` | `timestamptz` | no | Default `now() + interval '7 days'`; se renueva al avanzar la corrida. |
| `created_at` / `updated_at` | `timestamptz` | no | `updated_at` con el trigger `set_updated_at` ya existente. |
| `finished_at` | `timestamptz` | sí | Cuando llega a `done` o `failed`. En `done` es la misma fecha que `last_seen_at` de las prendas que siguen y de las creadas desde esta corrida. |

Índices: `(brand_id, created_at desc)` para el historial; `(expires_at)` para la purga.

**Seguridad (principio III)**: `enable row level security`; una policy `catalog_runs_staff_all` para
`authenticated` con `using/with check (public.is_staff())`; `GRANT select, insert, update, delete` a
`authenticated` y `all` a `service_role`; **ningún GRANT a `anon`**.

### Forma de `products[]` (cada elemento)

```json
{
  "handle": "vestido-lino",
  "title": "Vestido lino",
  "description_html": "<p>…</p>",
  "product_type": "Vestidos",
  "tags": ["verano"],
  "price": 189000,
  "colors": ["Beige"],
  "sizes": ["S", "M"],
  "image_url": "https://cdn.shopify.com/….jpg",
  "photo": { "file": "003-vestido-lino.jpg", "bytes": 412345, "status": "ok" },
  "notes": ["asignar categoría"]
}
```

`photo.status`: `pending` | `ok` | `missing` (la tienda no trae foto) | `failed` | `blocked`. Los textos de
`notes` son los mismos de la columna `revisar` del Excel.

### Forma de `comparison`

```json
{
  "computed_at": "2026-10-30T15:04:05Z",
  "comparable": 42,
  "high_missing_ratio": false,
  "siguen":     [{ "garment_id": "…", "title": "…" }],
  "nuevas":     [{ "handle": "…", "title": "…" }],
  "ya_no":      [{ "garment_id": "…", "title": "…", "status": "published", "last_seen_at": null }],
  "reaparecen": [{ "garment_id": "…", "title": "…", "status": "archived", "last_seen_at": "…" }],
  "sin_url":    [{ "garment_id": "…", "title": "…", "status": "pending", "last_seen_at": null }]
}
```

Los grupos guardan ids y títulos (no copias de la prenda). Al archivar/republicar se quita la prenda del
grupo correspondiente para que la pantalla refleje lo ya resuelto.

## Máquina de estados de una corrida

```text
          start (robots OK, consentimiento)
(nueva) ───────────────────────────────▶ reading ──(última página / CSV ya parseado)──▶ photos
                                           │                                              │
                                           │ sin productos                  fotos al día /│
                                           ▼                               skip_photos / │
                                        failed ◀──── error no recuperable ──── (cualquiera)│ bloqueo
                                                                                           ▼
                                                   discarded ◀── descartar ── building ──▶ done
```

- `advance` solo mueve `reading → photos → building → done`; cada paso usa compare-and-set sobre
  `(id, phase, cursor)`.
- `building` genera Excel y `origen.json`, los sube al almacén, calcula la comparación (si `is_complete`) y
  actualiza `last_seen_at` de las que siguen.
- Una corrida `reading`/`photos`/`building` sin avanzar sigue visible como **retomable** hasta `expires_at`.
- `discarded`/vencida ⇒ se borran sus objetos R2 y la fila (la fila se conserva marcada `discarded` si ya
  tenía `imported_at` o `actions`, por ser registro de procedencia).

## Relaciones

- `brands 1 ── N catalog_runs` · `users 1 ── N catalog_runs` (responsable e importador).
- `catalog_runs` **no** referencia `garments`: el vínculo es lógico por `productKey` y por ids dentro de
  `comparison`/`actions`, para que borrar una prenda no rompa el historial.
