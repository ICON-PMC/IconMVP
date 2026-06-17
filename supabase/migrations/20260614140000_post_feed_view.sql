-- Vista del feed: un post por fila con sus atributos filtrables ya agregados.
-- security_invoker = true -> respeta el RLS del rol que consulta (anon solo ve publicado).

create view post_feed
with (security_invoker = true) as
select
  p.id,
  p.caption,
  p.popularity,
  p.published_at,
  b.id           as brand_id,
  b.name         as brand_name,
  b.slug         as brand_slug,
  b.is_verified  as brand_verified,
  city.slug      as city_slug,
  city.name      as city_name,
  (
    select pi.cf_image_id
    from post_images pi
    where pi.post_id = p.id
    order by pi.position
    limit 1
  ) as image,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'occasion'), '{}')     as occasions,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'style'), '{}')        as styles,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'temperature'), '{}')  as temperatures,
  coalesce(array_agg(distinct cat.slug) filter (where cat.slug is not null), '{}')    as categories,
  min(g.price_cop) as min_price,
  max(g.price_cop) as max_price,
  coalesce(array_agg(distinct g.price_range::text) filter (where g.price_range is not null), '{}') as price_ranges
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
group by p.id, b.id, city.slug, city.name;

grant select on post_feed to anon, authenticated;
