# Contrato: RPC de Postgres (002)

Todas: `language plpgsql` (o `sql`), `security definer`, `set search_path = public`. Las públicas
validan **todo** dentro de la base de datos; la server action es una capa más, no la única.

## `submit_brand_request(p jsonb) → jsonb`  · EXECUTE: anon, authenticated

Entrada (`p`):
```json
{ "kind": "assisted|nomination", "brand_name": "…", "link": "…", "city": "…|null",
  "contact_name": "…|null", "contact": "…|null", "message": "…|null", "consent": true,
  "source_landing": "personas|marcas", "utm": {"source":"","medium":"","campaign":""},
  "idempotency_key": "uuid", "ip_hash": "hex" }
```
Salida:
| `status` | Cuándo | Extra |
|---|---|---|
| `ok` | insertada | `id` |
| `duplicate` | `idempotency_key` ya existe | `id` existente |
| `already_listed` | `nomination` y la marca ya está activa en Icon | `slug` |
| `invalid` | falla de validación | `errors: { campo: "mensaje en español" }` |
| `rate_limited` | más de 5 envíos del `ip_hash` en 10 min | — |

Reglas: las de [data-model.md](../data-model.md). `assisted` exige brand_name, contact_name, contact,
link, city y consent. `nomination` exige brand_name y link; si hay contacto, exige consent.

## `track_landing_event(p jsonb) → void`  · EXECUTE: anon, authenticated

Campos: `landing`, `event`, `target`, `section`, `outcome`, `utm`, `referrer_host`. Valores fuera de las
listas cerradas → se descarta en silencio (no lanza error).

## `landing_stats() → jsonb`  · EXECUTE: anon, authenticated

`{"brands": 12|null, "posts": 40|null, "people": null}`. El umbral se aplica aquí (10/50/100).

## `landing_event_summary(p_days int default 7) → jsonb`  · EXECUTE: authenticated (lanza error si no `is_staff()`)

`{ visits: {personas, marcas}, cta: [{landing, target, section, n}], forms: [{landing, target, outcome, n}],
  sources: [{utm_source, utm_campaign, referrer_host, n}] }`.

## `brand_request_list(p_kind text default null, p_limit int default 100) → setof record`  · staff

Filas de `brand_requests` + `nominations_count` (postulaciones con el mismo `brand_key`) y
`already_listed_slug`. Orden: `created_at desc`.
