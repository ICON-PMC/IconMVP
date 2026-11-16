-- Medidas reales de las fotos de prendas (spec 007, ajuste de la dueña 2026-11-16: el feed tipo
-- board de Pinterest usa la proporción real de cada foto). Antes, la rama de prendas de feed_items
-- devolvía image_width/image_height nulos y todas las tarjetas salían con la misma proporción.
--
-- Compatible con `main`: columnas nuevas nulas por defecto; la vista se recrea con las MISMAS
-- columnas, en el mismo orden y tipos (solo cambia de dónde salen dos valores), así que get_feed
-- (que devuelve setof feed_items) no se toca. Base: la definición de 20261114010000_colors.sql.

alter table public.garment_images add column if not exists width integer check (width is null or width > 0);
alter table public.garment_images add column if not exists height integer check (height is null or height > 0);

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
  (select count(*) from post_likes pl where pl.post_id = p.id)::int as like_count,
  coalesce((
    select array_agg(distinct c.slug)
    from post_items it2
    join garment_colors gc on gc.garment_id = it2.garment_id
    join colors c on c.id = gc.color_id
    where it2.post_id = p.id
  ), '{}') as colors
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
  (
    select gi.width from garment_images gi
    where gi.garment_id = g.id order by gi.position limit 1
  ) as image_width,
  (
    select gi.height from garment_images gi
    where gi.garment_id = g.id order by gi.position limit 1
  ) as image_height,
  coalesce((
    select array_agg(distinct t.slug) from (
      select x.slug from garment_tags own join tags x on x.id = own.tag_id
      where own.garment_id = g.id and x.type = 'occasion'
      union
      select x.slug from post_items it
      join posts pp on pp.id = it.post_id and pp.status = 'published'
      join post_tags pt on pt.post_id = pp.id
      join tags x on x.id = pt.tag_id and x.type = 'occasion'
      where it.garment_id = g.id
    ) t
  ), '{}') as occasions,
  coalesce((
    select array_agg(distinct t.slug) from (
      select x.slug from garment_tags own join tags x on x.id = own.tag_id
      where own.garment_id = g.id and x.type = 'style'
      union
      select x.slug from post_items it
      join posts pp on pp.id = it.post_id and pp.status = 'published'
      join post_tags pt on pt.post_id = pp.id
      join tags x on x.id = pt.tag_id and x.type = 'style'
      where it.garment_id = g.id
    ) t
  ), '{}') as styles,
  coalesce(array_agg(distinct cat.slug) filter (where cat.slug is not null), '{}') as categories,
  g.price_cop as min_price,
  g.price_cop as max_price,
  case when g.price_range is null then '{}'::text[] else array[g.price_range::text] end as price_ranges,
  g.popularity + 5.0 / (1 + extract(epoch from (now() - coalesce(g.published_at, g.created_at))) / 86400.0) as score,
  (select count(*) from garment_likes gl where gl.garment_id = g.id)::int as like_count,
  coalesce((
    select array_agg(c.slug order by c.position)
    from garment_colors gc join colors c on c.id = gc.color_id
    where gc.garment_id = g.id
  ), '{}') as colors
from garments g
join brands b on b.id = g.brand_id
left join cities city on city.id = b.city_id
left join garment_tags gt on gt.garment_id = g.id
left join tags cat on cat.id = gt.tag_id and cat.type = 'category'
where g.status = 'published'
group by g.id, b.id, city.slug, city.name;

grant select on feed_items to anon, authenticated;
