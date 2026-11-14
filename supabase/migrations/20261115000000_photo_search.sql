-- Búsqueda por foto (spec 005-busqueda-por-foto; constitución 1.2.0, principio VIII).
-- Huellas visuales del catálogo con pgvector + registro de búsquedas sin imagen.
-- Aditiva: el código de `main` no la usa y sigue funcionando (base compartida dev/prod).

create extension if not exists vector with schema extensions;

-- ============================================================
-- garment_embeddings: una huella visual (512 d, normalizada) por prenda
-- ============================================================
create table garment_embeddings (
  garment_id  uuid primary key references garments (id) on delete cascade,
  embedding   extensions.vector(512),
  image_key   text not null,
  model       text not null default 'fashion-clip-vit-b32-q8',
  status      text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  error       text,
  attempts    int not null default 0,
  updated_at  timestamptz not null default now()
);
create index garment_embeddings_hnsw on garment_embeddings
  using hnsw (embedding extensions.vector_cosine_ops) where status = 'ready';
create index garment_embeddings_status_idx on garment_embeddings (status);

alter table garment_embeddings enable row level security;
-- Sin lectura pública: las búsquedas pasan por RPC security definer. Staff ve el estado en /admin.
create policy garment_embeddings_staff_read on garment_embeddings
  for select to authenticated using (public.is_staff());
grant select on garment_embeddings to authenticated;
grant all on garment_embeddings to service_role;

-- ============================================================
-- photo_searches: registro SIN imagen (límite de uso y métricas, FR-014/019/020)
-- ============================================================
create table photo_searches (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null check (kind in ('photo', 'similar')),
  requester_key      text not null,
  user_id            uuid references users (id) on delete set null,
  detected_category  text,
  top_similarity     real,
  results            int not null,
  below_threshold    boolean not null,
  source_garment_id  uuid references garments (id) on delete set null,
  created_at         timestamptz not null default now()
);
create index photo_searches_requester_idx on photo_searches (requester_key, created_at desc);
create index photo_searches_created_idx on photo_searches (created_at);

alter table photo_searches enable row level security;
create policy photo_searches_staff_read on photo_searches
  for select to authenticated using (public.is_staff());
grant select on photo_searches to authenticated;
grant all on photo_searches to service_role;

-- Atribución de clics salientes desde estos resultados (principio II).
alter type click_source add value if not exists 'photo_search';
alter type click_source add value if not exists 'similar';

-- ============================================================
-- search_by_embedding: prendas publicadas más parecidas, con los filtros del feed.
-- La misma categoría que la detectada suma un pequeño empujón (FR-006).
-- Solo service_role: el vector lo calcula nuestro servidor.
-- ============================================================
create or replace function public.search_by_embedding(
  p_embedding extensions.vector(512),
  p_limit int default 48,
  p_cities text[] default null,
  p_occasions text[] default null,
  p_styles text[] default null,
  p_categories text[] default null,
  p_prices text[] default null,
  p_colors text[] default null,
  p_prefer_category text default null
)
returns table (id uuid, similarity real)
language sql stable security definer set search_path = public, extensions as $$
  select f.id, (1 - (e.embedding <=> p_embedding))::real as similarity
  from feed_items f
  join garment_embeddings e on e.garment_id = f.id and e.status = 'ready'
  join brands b on b.id = f.brand_id and b.is_active
  where f.kind = 'garment'
    and (p_cities is null or f.city_slug = any(p_cities))
    and (p_occasions is null or f.occasions && p_occasions)
    and (p_styles is null or f.styles && p_styles)
    and (p_categories is null or f.categories && p_categories)
    and (p_prices is null or f.price_ranges && p_prices)
    and (p_colors is null or f.colors && p_colors)
  order by (1 - (e.embedding <=> p_embedding))
           + case when p_prefer_category is not null and p_prefer_category = any(f.categories) then 0.05 else 0 end
           desc
  limit greatest(least(p_limit, 200), 0);
$$;
revoke execute on function public.search_by_embedding(extensions.vector, int, text[], text[], text[], text[], text[], text[], text)
  from public, anon, authenticated;
grant execute on function public.search_by_embedding(extensions.vector, int, text[], text[], text[], text[], text[], text[], text)
  to service_role;

-- Búsquedas de un solicitante en la última hora (límite de uso, FR-014).
create or replace function public.photo_search_quota(p_requester text)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from photo_searches
  where requester_key = p_requester and kind = 'photo' and created_at > now() - interval '1 hour';
$$;
revoke execute on function public.photo_search_quota(text) from public, anon, authenticated;
grant execute on function public.photo_search_quota(text) to service_role;
