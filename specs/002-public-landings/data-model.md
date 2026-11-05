# Data Model: Landings públicas (002)

Migración: `supabase/migrations/20261105000000_landings.sql`. Todo con RLS + GRANT explícito.

## `brand_requests`

Solicitud de subida asistida (marca) o postulación de marca (persona).

| Columna | Tipo | Regla |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `kind` | text | `check (kind in ('assisted','nomination'))` |
| `brand_name` | text | obligatorio, 2–80 |
| `brand_key` | text | generado en la RPC: handle IG normalizado, o `f_unaccent(lower(brand_name))` sin espacios |
| `link` | text | obligatorio; IG (`@handle` → `instagram.com/handle`) o URL `https://`, ≤ 300 |
| `city` | text null | texto libre corto (Barranquilla/Medellín/Bogotá/Otra); obligatorio en `assisted` |
| `contact_name` | text null | obligatorio en `assisted`, ≤ 80 |
| `contact` | text null | correo o celular normalizado (`57XXXXXXXXXX`); obligatorio en `assisted`, opcional en `nomination` |
| `contact_kind` | text null | `email | whatsapp` |
| `message` | text null | ≤ 500 |
| `consent_at` | timestamptz null | **obligatorio si `contact` no es null** (check) |
| `source_landing` | text | `check in ('personas','marcas')` |
| `utm_source`, `utm_medium`, `utm_campaign` | text null | ≤ 100 |
| `idempotency_key` | uuid **unique** | lo genera el cliente por formulario montado |
| `ip_hash` | text | sha256 (IP + sal); solo para limitar la frecuencia |
| `created_at` | timestamptz | `now()` |

Índices: `(kind, created_at desc)`, `(brand_key)`, `(ip_hash, created_at)`.

**RLS**: `select` solo para `is_staff()`. Sin `insert/update/delete` para `anon`/`authenticated` (solo
vía RPC). **GRANT**: `select` a `authenticated` (filtrado por la policy), `all` a `service_role`; nada a
`anon`.

Fuera de alcance (spec): estados tipo CRM. El equipo responde por WhatsApp y no se registra el estado.

## `landing_events`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | bigint identity PK | |
| `landing` | text | `in ('personas','marcas')` |
| `event` | text | `in ('page_view','cta_click','form_submit')` |
| `target` | text null | id del botón o formulario (lista cerrada, ver contrato), ≤ 40 |
| `section` | text null | sección de la página, ≤ 40 |
| `outcome` | text null | `form_submit`: `ok | error | duplicate | already_listed | rate_limited` |
| `utm_source`, `utm_medium`, `utm_campaign` | text null | ≤ 100 |
| `referrer_host` | text null | solo el host (sin ruta ni query), ≤ 100 |
| `created_at` | timestamptz | `now()` |

Índice: `(landing, created_at)`. Sin datos personales; sin IP; sin id de usuario.

**RLS**: `select` solo para `is_staff()`. Sin escritura directa (solo RPC). **GRANT**: igual que arriba.

## Agregados públicos (sin tabla)

`landing_stats()` → `{ brands int|null, posts int|null, people int|null }`, con umbral 10/50/100
aplicado en la base.

## Relación con entidades existentes

- `brands` (`is_active`, `slug`, `instagram`, `logo_url`): detecta `already_listed` y alimenta los logos.
- `feed_items`: fotos reales de prendas publicadas.
- `users.role`: conteo de personas (`role = 'user'`).

## `database.types.ts`

Se agregan `Tables.brand_requests`, `Tables.landing_events` y `Functions.submit_brand_request |
track_landing_event | landing_stats | landing_event_summary | brand_request_list`, a mano y en el mismo
commit que la migración.
