-- Feed mixto (outfits + prendas): popularidad de prendas + vista/RPC de feed unificado.
-- Spec: specs/2026-09-21-mixed-feed/plan.md, grupo 2.

-- ============================================================
-- Popularidad de prendas: mismo patrón que bump_post_popularity()
-- (20260616120000_popularity_and_analytics.sql). guardar +3, clic saliente +1.
-- ============================================================
create or replace function public.bump_garment_popularity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'saved_garments' then
    if tg_op = 'INSERT' then
      update garments set popularity = popularity + 3 where id = new.garment_id;
    elsif tg_op = 'DELETE' then
      update garments set popularity = greatest(popularity - 3, 0) where id = old.garment_id;
    end if;
  elsif tg_table_name = 'outbound_clicks' then
    if tg_op = 'INSERT' and new.garment_id is not null then
      update garments set popularity = popularity + 1 where id = new.garment_id;
    end if;
  end if;
  return null;
end; $$;

drop trigger if exists saved_garments_popularity on saved_garments;
create trigger saved_garments_popularity
  after insert or delete on saved_garments
  for each row execute function public.bump_garment_popularity();

drop trigger if exists outbound_clicks_garment_popularity on outbound_clicks;
create trigger outbound_clicks_garment_popularity
  after insert on outbound_clicks
  for each row execute function public.bump_garment_popularity();

-- Backfill con lo que ya exista, igual que en posts.
update garments g set popularity =
  coalesce((select count(*) from saved_garments s where s.garment_id = g.id), 0) * 3
  + coalesce((select count(*) from outbound_clicks o where o.garment_id = g.id), 0) * 1;

-- ============================================================
-- Vista del feed unificado: un row por post o por prenda, con `kind` y el mismo `score`.
-- Ocasión/estilo en prendas: heredan las de los posts publicados que las taggean (post_items).
-- security_invoker = true -> respeta RLS (solo marcas activas + contenido publicado, como post_feed).
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
  g.popularity + 5.0 / (1 + extract(epoch from (now() - coalesce(g.published_at, g.created_at))) / 86400.0) as score
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

-- ============================================================
-- RPC paginada sobre feed_items. security invoker (default de una función sin
-- `security definer`) -> respeta la RLS de quien llama, igual que la vista.
-- Paginación estable: score desc (o el campo del sort elegido) + id como desempate.
-- ============================================================
create or replace function public.get_feed(
  p_cities text[] default null,
  p_occasions text[] default null,
  p_styles text[] default null,
  p_categories text[] default null,
  p_prices text[] default null,
  p_sort text default 'relevant',
  p_limit int default 24,
  p_offset int default 0
)
returns setof feed_items
language sql stable
as $$
  select *
  from feed_items
  where (p_cities is null or city_slug = any(p_cities))
    and (p_occasions is null or occasions && p_occasions)
    and (p_styles is null or styles && p_styles)
    and (p_categories is null or categories && p_categories)
    and (p_prices is null or price_ranges && p_prices)
  order by
    (case when p_sort = 'new' then published_at end) desc nulls last,
    (case when p_sort = 'popular' then popularity end) desc nulls last,
    (case when p_sort = 'az' then brand_name end) asc nulls last,
    (case when p_sort is null or p_sort = 'relevant' then score end) desc nulls last,
    id
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.get_feed(text[], text[], text[], text[], text[], text, int, int)
  to anon, authenticated;

-- ============================================================
-- Etiquetas (ocasión/estilo) más frecuentes en el contenido publicado, para los chips
-- de sugerencia de un visitante sin sesión (u onboarding omitido). Grupo 6.
-- ============================================================
create or replace function public.popular_content_tags(p_limit int default 6)
returns table (slug text, name text, type text)
language sql stable
as $$
  select t.slug, t.name, t.type::text
  from tags t
  join post_tags pt on pt.tag_id = t.id
  join posts p on p.id = pt.post_id and p.status = 'published'
  join brands b on b.id = p.author_brand_id and b.is_active
  where t.type in ('occasion', 'style')
  group by t.id, t.slug, t.name, t.type
  order by count(*) desc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.popular_content_tags(int) to anon, authenticated;
