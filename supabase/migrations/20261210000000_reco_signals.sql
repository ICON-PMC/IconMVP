-- Spec 003, migración A: señales para la recomendación (impresiones, vistas de detalle, búsquedas) y
-- pesos editables. Aditiva: el código de `main` no la usa. Sin identificadores persistentes para
-- anónimos: `anon_key` vive en sessionStorage de la pestaña (FR-005/FR-006).
-- Toda función nueva lleva revoke/grant explícito (20261121000000_harden_table_privileges.sql).

do $$ begin create type event_kind as enum ('impression', 'detail_view');
exception when duplicate_object then null; end $$;
do $$ begin create type event_item as enum ('garment', 'post', 'brand');
exception when duplicate_object then null; end $$;
do $$ begin create type event_surface as enum ('feed', 'following', 'search', 'profile', 'brand_page', 'similar', 'photo_search', 'detail');
exception when duplicate_object then null; end $$;

-- Ventana de deduplicación de 30 minutos.
create or replace function public._event_bucket(t timestamptz)
returns timestamptz language sql immutable as $$ select date_bin('30 minutes', t, timestamptz 'epoch') $$;

-- ============================================================
-- 1. interaction_events
-- ============================================================
create table if not exists public.interaction_events (
  id           bigint generated always as identity primary key,
  user_id      uuid references public.users (id) on delete cascade,
  anon_key     text,
  kind         event_kind not null,
  item_kind    event_item not null,
  item_id      uuid not null,
  surface      event_surface not null,
  position     integer check (position is null or position between 0 and 2000),
  sort         text check (sort is null or sort in ('relevant', 'new', 'popular', 'az', 'rating')),
  personalized boolean not null default false,
  bucket       timestamptz not null,
  created_at   timestamptz not null default now(),
  constraint interaction_events_actor check (user_id is not null or anon_key ~ '^[a-z0-9]{16,32}$')
);
create unique index if not exists interaction_events_dedup_idx
  on public.interaction_events ((coalesce(user_id::text, anon_key)), kind, item_kind, item_id, surface, bucket);
create index if not exists interaction_events_user_idx on public.interaction_events (user_id, created_at desc) where user_id is not null;
create index if not exists interaction_events_created_idx on public.interaction_events (created_at);

alter table public.interaction_events enable row level security;
drop policy if exists interaction_events_read on public.interaction_events;
create policy interaction_events_read on public.interaction_events for select to authenticated
  using (user_id = (select public.current_user_id()) or public.is_staff());
grant select on public.interaction_events to authenticated;
grant all on public.interaction_events to service_role;

-- ============================================================
-- 2. search_events
-- ============================================================
create table if not exists public.search_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.users (id) on delete cascade,
  anon_key   text,
  q          text check (q is null or char_length(q) <= 200),
  q_norm     text generated always as (public.f_unaccent(lower(btrim(q)))) stored,
  filters    jsonb not null default '{}',
  tab        text not null check (tab in ('garments', 'posts', 'brands', 'feed')),
  sort       text,
  results    integer not null check (results >= 0),
  bucket     timestamptz not null,
  created_at timestamptz not null default now(),
  constraint search_events_actor check (user_id is not null or anon_key ~ '^[a-z0-9]{16,32}$')
);
create unique index if not exists search_events_dedup_idx
  on public.search_events ((coalesce(user_id::text, anon_key)), (coalesce(q_norm, '')), (md5(filters::text)), tab, bucket);
create index if not exists search_events_created_idx on public.search_events (created_at);
create index if not exists search_events_zero_idx on public.search_events (q_norm) where results = 0;

alter table public.search_events enable row level security;
drop policy if exists search_events_read on public.search_events;
create policy search_events_read on public.search_events for select to authenticated
  using (user_id = (select public.current_user_id()) or public.is_staff());
grant select on public.search_events to authenticated;
grant all on public.search_events to service_role;

-- ============================================================
-- 3. reco_settings: pesos de partida (research R2–R3), editables por el equipo
-- ============================================================
create table if not exists public.reco_settings (
  id                 int primary key default 1 check (id = 1),
  w_click            numeric not null default 5,
  w_save             numeric not null default 4,
  w_like             numeric not null default 3,
  w_follow           numeric not null default 3,
  w_view             numeric not null default 1,
  w_declared_style   numeric not null default 3,
  w_declared_city    numeric not null default 2,
  half_life_days     numeric not null default 30 check (half_life_days > 0),
  mix_affinity       numeric not null default 0.60,
  mix_quality        numeric not null default 0.25,
  mix_recency        numeric not null default 0.15,
  explore_every      int not null default 5 check (explore_every >= 2),
  d_style            numeric not null default 0.25,
  d_category         numeric not null default 0.20,
  d_brand            numeric not null default 0.20,
  d_occasion         numeric not null default 0.10,
  d_author           numeric not null default 0.10,
  d_city             numeric not null default 0.10,
  d_price            numeric not null default 0.05,
  updated_at         timestamptz not null default now()
);
insert into public.reco_settings (id) values (1) on conflict do nothing;

alter table public.reco_settings enable row level security;
drop policy if exists reco_settings_read on public.reco_settings;
create policy reco_settings_read on public.reco_settings for select to authenticated using (true);
drop policy if exists reco_settings_staff_update on public.reco_settings;
create policy reco_settings_staff_update on public.reco_settings for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
grant select, update on public.reco_settings to authenticated;
grant all on public.reco_settings to service_role;

-- ============================================================
-- 4. log_events: única puerta de escritura
-- ============================================================
create or replace function public.log_events(p jsonb)
returns int language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
  akey text := case when me is null then lower(p ->> 'anon_key') end;
  b timestamptz := public._event_bucket(now());
  n int := 0;
  k int;
  e jsonb;
  total int;
begin
  if me is null and (akey is null or akey !~ '^[a-z0-9]{16,32}$') then
    raise exception 'anon_key requerido' using errcode = '22023';
  end if;
  total := coalesce(jsonb_array_length(p -> 'impressions'), 0) + coalesce(jsonb_array_length(p -> 'views'), 0)
         + coalesce(jsonb_array_length(p -> 'searches'), 0);
  if total > 50 then
    raise exception 'Máximo 50 eventos por lote' using errcode = '22023';
  end if;

  -- Impresiones y vistas: solo de ítems publicados (o marcas activas).
  insert into interaction_events (user_id, anon_key, kind, item_kind, item_id, surface, position, sort, personalized, bucket)
  select me, akey, x.kind, x.item_kind, x.item_id, x.surface, x.position,
         case when x.sort in ('relevant', 'new', 'popular', 'az', 'rating') then x.sort end, coalesce(x.personalized, false), b
    from (
      select 'impression'::event_kind kind, (i ->> 'itemKind')::event_item item_kind, (i ->> 'itemId')::uuid item_id,
             (i ->> 'surface')::event_surface surface, least(greatest((i ->> 'position')::int, 0), 2000) position,
             i ->> 'sort' sort, (i ->> 'personalized')::boolean personalized
        from jsonb_array_elements(coalesce(p -> 'impressions', '[]')) i
      union all
      select 'detail_view', (v ->> 'itemKind')::event_item, (v ->> 'itemId')::uuid, 'detail'::event_surface, null, null, false
        from jsonb_array_elements(coalesce(p -> 'views', '[]')) v
    ) x
   where (x.item_kind = 'garment' and exists (select 1 from garments g where g.id = x.item_id and g.status = 'published'))
      or (x.item_kind = 'post' and exists (select 1 from posts po where po.id = x.item_id and po.status = 'published'))
      or (x.item_kind = 'brand' and exists (select 1 from brands br where br.id = x.item_id and br.is_active))
  on conflict do nothing;
  get diagnostics k = row_count;
  n := n + k;

  insert into search_events (user_id, anon_key, q, filters, tab, sort, results, bucket)
  select me, akey, nullif(left(btrim(s ->> 'q'), 200), ''), coalesce(s -> 'filters', '{}'),
         s ->> 'tab', left(s ->> 'sort', 20), greatest((s ->> 'results')::int, 0), b
    from jsonb_array_elements(coalesce(p -> 'searches', '[]')) s
   where s ->> 'tab' in ('garments', 'posts', 'brands', 'feed')
  on conflict do nothing;
  get diagnostics k = row_count;
  return n + k;
end; $$;
revoke execute on function public.log_events(jsonb) from public;
grant execute on function public.log_events(jsonb) to anon, authenticated, service_role;

create or replace function public.purge_old_events(p_days int)
returns int language plpgsql volatile security definer set search_path = public as $$
declare a int; b int;
begin
  delete from interaction_events where created_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics a = row_count;
  delete from search_events where created_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics b = row_count;
  return a + b;
end; $$;
revoke execute on function public.purge_old_events(int) from public, anon, authenticated;
grant execute on function public.purge_old_events(int) to service_role;

-- Índices para calcular el perfil de gusto (migración B).
create index if not exists saved_posts_user_created_idx on public.saved_posts (user_id, created_at);
create index if not exists saved_garments_user_created_idx on public.saved_garments (user_id, created_at);
create index if not exists outbound_clicks_user_created_idx on public.outbound_clicks (user_id, created_at) where user_id is not null;
