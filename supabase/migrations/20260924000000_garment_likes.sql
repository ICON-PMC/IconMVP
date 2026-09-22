-- Likes en prendas (espejo de `post_likes`).
-- Motivo: el feed mixto (`feed_items.kind`) muestra prendas y outfits; con el like solo en
-- posts, la señal quedaba invisible en la mayor parte de las tarjetas. Ahora el like existe
-- para los dos tipos que muestra el feed.
--
-- Simétrico a `saved_posts` / `saved_garments`: una tabla por tipo y un solo componente de
-- UI (`LikeButton` con `kind`), igual que ya hace `SaveButton`.
-- El like NO toca `garments.popularity` ni el orden del feed (decisión 6).

-- ============================================================
-- garment_likes — una fila por (usuario, prenda) con like
-- ============================================================
create table garment_likes (
  user_id     uuid not null references users (id) on delete cascade,
  garment_id  uuid not null references garments (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, garment_id)
);
create index garment_likes_garment_idx on garment_likes (garment_id);

-- ============================================================
-- RLS — escritura restringida al dueño; lectura pública para el contador.
-- Mismo criterio que `post_likes`: NO se usa `for all` porque incluiría SELECT y
-- limitaría el conteo público a las filas propias.
-- ============================================================
alter table garment_likes enable row level security;

create policy garment_likes_insert on garment_likes
  for insert to authenticated
  with check (user_id = (select public.current_user_id()));
create policy garment_likes_delete on garment_likes
  for delete to authenticated
  using (user_id = (select public.current_user_id()));
create policy garment_likes_read on garment_likes
  for select to anon, authenticated using (true);

-- GRANT explícito: RLS + GRANT siempre en par (constitución §7.2). El select base ya lo da
-- el grant global de init.sql.
grant insert, delete on garment_likes to authenticated;

-- ============================================================
-- feed_items: la rama de prendas cuenta sus likes en vez del `0` literal.
-- Se recrea la vista completa porque `create or replace view` exige la misma lista de
-- columnas en el mismo orden; lo único que cambia es la expresión de `like_count`.
-- ============================================================
create or replace view feed_items
with (security_invoker = true) as
select
  'post'::text as kind,
  p.id,
  p.caption as title,
  p.popularity,
  p.published_at,
  p.created_at,
  b.id           as brand_id,
  b.name         as brand_name,
  b.slug         as brand_slug,
  b.is_verified  as brand_verified,
  city.slug      as city_slug,
  city.name      as city_name,
  (
    select pi.cf_image_id from post_images pi
    where pi.post_id = p.id order by pi.position limit 1
  ) as image,
  (
    select pi.width from post_images pi
    where pi.post_id = p.id order by pi.position limit 1
  ) as image_width,
  (
    select pi.height from post_images pi
    where pi.post_id = p.id order by pi.position limit 1
  ) as image_height,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'occasion'), '{}')  as occasions,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'style'), '{}')     as styles,
  coalesce(array_agg(distinct cat.slug) filter (where cat.slug is not null), '{}') as categories,
  min(g.price_cop) as min_price,
  max(g.price_cop) as max_price,
  coalesce(array_agg(distinct g.price_range::text) filter (where g.price_range is not null), '{}') as price_ranges,
  p.popularity + 5.0 / (1 + extract(epoch from (now() - coalesce(p.published_at, p.created_at))) / 86400.0) as score,
  (select count(*) from post_likes pl where pl.post_id = p.id)::int as like_count
from posts p
join brands b on b.id = p.author_brand_id
left join cities city on city.id = b.city_id
left join post_tags pt on pt.post_id = p.id
left join tags lt on lt.id = pt.tag_id
left join post_items it on it.post_id = p.id
left join garments g on g.id = it.garment_id
left join garment_tags gt on gt.garment_id = g.id
left join tags cat on cat.id = gt.tag_id and cat.type = 'category'
where p.status = 'published'
group by p.id, b.id, city.slug, city.name

union all

select
  'garment'::text as kind,
  g.id,
  g.title,
  g.popularity,
  g.published_at,
  g.created_at,
  b.id           as brand_id,
  b.name         as brand_name,
  b.slug         as brand_slug,
  b.is_verified  as brand_verified,
  city.slug      as city_slug,
  city.name      as city_name,
  (
    select gi.cf_image_id from garment_images gi
    where gi.garment_id = g.id order by gi.position limit 1
  ) as image,
  null::integer as image_width,   -- garment_images no guarda dimensiones (grupo 1)
  null::integer as image_height,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'occasion'), '{}')  as occasions,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'style'), '{}')     as styles,
  coalesce(array_agg(distinct cat.slug) filter (where cat.slug is not null), '{}') as categories,
  g.price_cop as min_price,
  g.price_cop as max_price,
  coalesce(array_agg(distinct g.price_range::text) filter (where g.price_range is not null), '{}') as price_ranges,
  g.popularity + 5.0 / (1 + extract(epoch from (now() - coalesce(g.published_at, g.created_at))) / 86400.0) as score,
  (select count(*) from garment_likes gl where gl.garment_id = g.id)::int as like_count
from garments g
join brands b on b.id = g.brand_id
left join cities city on city.id = b.city_id
left join garment_tags gt on gt.garment_id = g.id
left join tags cat on cat.id = gt.tag_id and cat.type = 'category'
left join post_items it on it.garment_id = g.id
left join posts pp on pp.id = it.post_id and pp.status = 'published'
left join post_tags pt on pt.post_id = pp.id
left join tags lt on lt.id = pt.tag_id
where g.status = 'published'
group by g.id, b.id, city.slug, city.name;

grant select on feed_items to anon, authenticated;
