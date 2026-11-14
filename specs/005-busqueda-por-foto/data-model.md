# Data model: Búsqueda por foto (005)

Migración prevista: `supabase/migrations/2026111500000x_photo_search.sql` (aditiva; compatible con el
código de `main` mientras dev y producción comparten base).

## Extensión
- `create extension if not exists vector with schema extensions;`

## garment_embeddings — huella visual de cada prenda (spec: "Huella visual de prenda")

| Campo | Tipo | Notas |
|---|---|---|
| `garment_id` | uuid PK → `garments(id)` on delete cascade | una por prenda |
| `embedding` | `extensions.vector(512)` null | normalizado (norma 1); null mientras está pendiente |
| `image_key` | text not null | clave R2 de la foto usada; si cambia la foto principal → `pending` |
| `model` | text not null default `'fashion-clip-vit-b32-q8'` | permite reindexar al cambiar de modelo |
| `status` | text check in (`pending`,`ready`,`failed`) | |
| `error` | text null | último error (para `/admin`) |
| `attempts` | int default 0 | se deja de reintentar sola tras 5 |
| `updated_at` | timestamptz default now() | |

- Índice HNSW: `using hnsw (embedding extensions.vector_cosine_ops) where status = 'ready'`.
- RLS: lectura pública de (`garment_id`, `status`) **no** necesaria → sin policy para anon/authenticated;
  las RPC son `security definer` y filtran por prendas publicadas. Escritura solo `service_role` y staff.
- GRANT: `all` a `service_role`; `select` a `authenticated` vía policy staff (para `/admin`).

**Transiciones**: (sin fila) → `pending` (trigger al publicar o al cambiar la foto 0) → `ready` |
`failed` (procesador). `failed` → `pending` (reintento manual en `/admin`). Cambio de foto en `ready`
→ `pending`.

**Triggers**:
- `garment_images` after insert/update/delete con `position = 0` → upsert `pending` con la nueva clave.
- `garments` after update of `status` → si pasa a `published` y no hay fila `ready` con la clave
  actual → `pending`.

## photo_searches — registro sin imagen (FR-014, FR-019, FR-020)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `kind` | text check in (`photo`,`similar`) | búsqueda por foto o "más como esta" |
| `requester_key` | text not null | hash SHA-256 de (IP + sal diaria) o `user:<id>`; para el límite |
| `user_id` | uuid null → `users(id)` on delete set null | solo para métricas; nunca la foto |
| `detected_category` | text null | slug de categoría |
| `top_similarity` | real null | similitud del mejor resultado |
| `results` | int not null | |
| `below_threshold` | boolean not null | resultados "lo más cercano" (FR-007) |
| `source_garment_id` | uuid null | para `similar` |
| `created_at` | timestamptz default now() | índice (`requester_key`, `created_at`) |

- RLS: insert solo vía RPC/servidor (`service_role`); select solo staff (métricas).
- Retención: borrado de filas > 180 días (job en la misma ruta de cron).
- Los clics salientes desde estos resultados se atribuyen con `outbound_clicks.source` (enum
  `click_source`): se agregan los valores `photo_search` y `similar` (aditivo).

## Constantes en código (no en base)
- `src/lib/visual/prompts.json`: vectores de texto precalculados (512 d) para cada categoría de Icon y
  para las frases de contenido no permitido; generados con `scripts/build-visual-prompts.ts`.
- Umbrales: `SIMILAR_MIN` (lo que cuenta como "muy parecido", FR-007) y `BLOCK_MIN` (FR-015),
  calibrados con el set de referencia de SC-001.
