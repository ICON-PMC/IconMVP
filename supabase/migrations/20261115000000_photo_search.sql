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

-- La ruta de búsqueda arma las tarjetas desde feed_items con el cliente de servicio; la vista
-- (security_invoker) cuenta likes, así que el rol necesita leer también esas tablas.
grant select on feed_items, post_likes, garment_likes to service_role;

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

-- ============================================================
-- similar_garments: "Más como esta" (FR-011). Sin la propia prenda, máximo 2 por marca,
-- solo por encima del umbral de parecido. Público.
-- ============================================================
create or replace function public.similar_garments(
  p_garment_id uuid,
  p_limit int default 8,
  p_min real default 0.78
)
returns table (id uuid, similarity real)
language sql stable security definer set search_path = public, extensions as $$
  with src as (
    select e.embedding from garment_embeddings e
    join garments g on g.id = e.garment_id and g.status = 'published'
    where e.garment_id = p_garment_id and e.status = 'ready'
  ),
  ranked as (
    select g.id, (1 - (e.embedding <=> (select embedding from src)))::real as similarity,
           row_number() over (partition by g.brand_id
             order by e.embedding <=> (select embedding from src)) as brand_rank
    from garment_embeddings e
    join garments g on g.id = e.garment_id and g.status = 'published'
    join brands b on b.id = g.brand_id and b.is_active
    where e.status = 'ready' and g.id <> p_garment_id and exists (select 1 from src)
  )
  select id, similarity from ranked
  where brand_rank <= 2 and similarity >= p_min
  order by similarity desc
  limit greatest(least(p_limit, 48), 0);
$$;
grant execute on function public.similar_garments(uuid, int, real) to anon, authenticated, service_role;

-- ============================================================
-- Indexación automática (FR-016/017): los triggers solo marcan `pending`; el cálculo lo hacen
-- las acciones del servidor (after()) y el cron de /api/embeddings/process.
-- ============================================================
create or replace function public.mark_embedding_pending(p_garment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  k text := (select cf_image_id from garment_images where garment_id = p_garment_id
             order by position limit 1);
begin
  if k is null or not exists (select 1 from garments where id = p_garment_id and status = 'published') then
    return;
  end if;
  insert into garment_embeddings (garment_id, image_key, status, attempts, error, updated_at)
  values (p_garment_id, k, 'pending', 0, null, now())
  on conflict (garment_id) do update
    set image_key = excluded.image_key, status = 'pending', attempts = 0, error = null, updated_at = now()
    where garment_embeddings.image_key is distinct from excluded.image_key
       or garment_embeddings.status = 'failed';
end; $$;
revoke execute on function public.mark_embedding_pending(uuid) from public, anon, authenticated;

create or replace function public.garment_images_embedding_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.mark_embedding_pending(coalesce(new.garment_id, old.garment_id));
  return null;
end; $$;
create trigger garment_images_embedding
  after insert or update or delete on garment_images
  for each row execute function public.garment_images_embedding_trigger();

create or replace function public.garments_embedding_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    perform public.mark_embedding_pending(new.id);
  end if;
  return null;
end; $$;
create trigger garments_embedding
  after update of status on garments
  for each row execute function public.garments_embedding_trigger();

-- Estado del índice para /admin (FR-018). Solo staff (RLS de garment_embeddings).
create or replace function public.visual_index_status()
returns table (status text, n int)
language sql stable security invoker as $$
  select coalesce(e.status, 'sin_foto') as status, count(*)::int
  from garments g left join garment_embeddings e on e.garment_id = g.id
  where g.status = 'published'
  group by 1;
$$;
grant execute on function public.visual_index_status() to authenticated;
