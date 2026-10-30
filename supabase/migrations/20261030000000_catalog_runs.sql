-- Importar catálogo de una marca desde /admin/bulk (specs/001-catalog-scrape-bulk).
--  1. garments.last_seen_at / discontinued_at: detectar prendas que la marca ya no vende.
--  2. catalog_runs: corrida reanudable de lectura de catálogo + registro de procedencia y consentimiento.
-- Solo staff (RLS + GRANT explícitos, sin acceso anon). Idempotente.

-- ============================================================
-- 1. garments: última vez vista en la tienda + archivada por la sincronización
-- ============================================================
alter table garments add column if not exists last_seen_at     timestamptz;  -- null = "sin verificar"
alter table garments add column if not exists discontinued_at  timestamptz;  -- archivada desde la comparación

-- last_seen_at se actualiza en lote en cada lectura completa de la tienda; no debe contar como una
-- "edición" (updated_at). Cualquier otro cambio sigue actualizando updated_at como antes.
-- search_text es una columna generada: en un trigger BEFORE todavía no está calculada en NEW, así que
-- también se excluye de la comparación (si no, siempre parecería que "algo más cambió").
create or replace function public.garments_touch_updated_at()
returns trigger language plpgsql as $$
begin
  if new.last_seen_at is distinct from old.last_seen_at
     and (to_jsonb(new) - 'last_seen_at' - 'updated_at' - 'search_text')
         = (to_jsonb(old) - 'last_seen_at' - 'updated_at' - 'search_text') then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end; $$;

drop trigger if exists garments_set_updated_at on garments;
create trigger garments_set_updated_at before update on garments
  for each row execute function public.garments_touch_updated_at();

-- ============================================================
-- 2. catalog_runs
-- ============================================================
create table if not exists catalog_runs (
  id                 uuid primary key default gen_random_uuid(),
  brand_id           uuid not null references brands (id) on delete cascade,
  created_by         uuid references users (id) on delete set null,
  source_kind        text not null check (source_kind in ('shop', 'csv')),
  origin             text,
  source_label       text not null,
  consent_confirmed  boolean not null check (consent_confirmed),
  contact            text not null,
  options            jsonb not null,
  phase              text not null check (phase in ('reading', 'photos', 'building', 'done', 'failed', 'discarded')),
  cursor             integer not null default 0,
  currency           text,
  products           jsonb not null default '[]'::jsonb check (jsonb_array_length(products) <= 500),
  stats              jsonb not null default '{}'::jsonb,
  unknown_sizes      jsonb not null default '{}'::jsonb,
  is_complete        boolean not null default false,
  comparison         jsonb,
  package_keys       jsonb not null default '{"xlsx":null,"origen":null,"photos":[]}'::jsonb,
  imported_at        timestamptz,
  imported_by        uuid references users (id) on delete set null,
  import_stats       jsonb,
  actions            jsonb not null default '[]'::jsonb,
  error              text,
  expires_at         timestamptz not null default now() + interval '7 days',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  finished_at        timestamptz
);

create index if not exists catalog_runs_brand_idx   on catalog_runs (brand_id, created_at desc);
create index if not exists catalog_runs_expires_idx on catalog_runs (expires_at);

drop trigger if exists catalog_runs_set_updated_at on catalog_runs;
create trigger catalog_runs_set_updated_at before update on catalog_runs
  for each row execute function set_updated_at();

alter table catalog_runs enable row level security;

drop policy if exists catalog_runs_staff_all on catalog_runs;
create policy catalog_runs_staff_all on catalog_runs
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- RLS + GRANT en par (auto-expose desactivado). Ningún GRANT a anon.
grant select, insert, update, delete on catalog_runs to authenticated;
grant all on catalog_runs to service_role;
