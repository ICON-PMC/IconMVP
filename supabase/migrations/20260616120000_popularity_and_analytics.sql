-- Popularidad del feed (señales) + vistas de analítica de clics.

-- ============================================================
-- Popularidad: se mantiene en posts.popularity vía triggers.
-- guardar post = +3, clic saliente sobre el post = +1.
-- security definer para poder actualizar posts sin importar quién dispare.
-- ============================================================
create or replace function public.bump_post_popularity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'saved_posts' then
    if tg_op = 'INSERT' then
      update posts set popularity = popularity + 3 where id = new.post_id;
    elsif tg_op = 'DELETE' then
      update posts set popularity = greatest(popularity - 3, 0) where id = old.post_id;
    end if;
  elsif tg_table_name = 'outbound_clicks' then
    if tg_op = 'INSERT' and new.post_id is not null then
      update posts set popularity = popularity + 1 where id = new.post_id;
    end if;
  end if;
  return null;
end; $$;

create trigger saved_posts_popularity
  after insert or delete on saved_posts
  for each row execute function public.bump_post_popularity();

create trigger outbound_clicks_popularity
  after insert on outbound_clicks
  for each row execute function public.bump_post_popularity();

-- Backfill con lo que ya exista.
update posts p set popularity =
  coalesce((select count(*) from saved_posts s where s.post_id = p.id), 0) * 3
  + coalesce((select count(*) from outbound_clicks o where o.post_id = p.id), 0) * 1;

-- ============================================================
-- Vista del feed: añade `score` = popularidad + recencia (decae con la antigüedad).
-- ============================================================
create or replace view post_feed
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
    select pi.cf_image_id from post_images pi
    where pi.post_id = p.id order by pi.position limit 1
  ) as image,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'occasion'), '{}')     as occasions,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'style'), '{}')        as styles,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'temperature'), '{}')  as temperatures,
  coalesce(array_agg(distinct cat.slug) filter (where cat.slug is not null), '{}')    as categories,
  min(g.price_cop) as min_price,
  max(g.price_cop) as max_price,
  coalesce(array_agg(distinct g.price_range::text) filter (where g.price_range is not null), '{}') as price_ranges,
  p.popularity + 5.0 / (1 + extract(epoch from (now() - coalesce(p.published_at, p.created_at))) / 86400.0) as score
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

-- ============================================================
-- Analítica de clics (solo staff puede leer outbound_clicks).
-- ============================================================
create policy outbound_clicks_staff_read on outbound_clicks
  for select to authenticated using (public.is_staff());

create view brand_click_counts
with (security_invoker = true) as
  select b.id as brand_id, b.name as brand_name, count(oc.id)::int as clicks
  from brands b
  left join outbound_clicks oc on oc.brand_id = b.id
  group by b.id, b.name;
grant select on brand_click_counts to authenticated;

create view garment_click_counts
with (security_invoker = true) as
  select g.id as garment_id, g.title, g.brand_id, count(oc.id)::int as clicks
  from garments g
  left join outbound_clicks oc on oc.garment_id = g.id
  group by g.id, g.title, g.brand_id;
grant select on garment_click_counts to authenticated;
