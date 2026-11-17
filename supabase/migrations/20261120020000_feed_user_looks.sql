-- Spec 008, migración C: los looks de usuarios entran al feed, los filtros y la búsqueda.
--
-- ⚠️ Cambia vistas y funciones que usa producción. Aplicar a la nube SOLO cuando el código que tolera
-- marca nula y columnas de autor esté en `main` (research R11, paso 3 del despliegue), y después de
-- borrar los looks de prueba.
--
-- Bases (última versión aplicada de cada una):
--   feed_items   ← 20261116020000_garment_image_dims.sql
--   get_feed     ← 20261114010000_colors.sql (firma con p_colors)
--   search_posts ← 20261006030000_search_synonyms.sql
-- Dependencias revisadas: search_by_embedding y similar_garments usan solo la rama de prendas y
-- columnas por nombre (no cambian); feed_style_counts usa f.styles (no cambia).

begin;

-- 1. get_feed devuelve `setof feed_items`: hay que borrarla antes de cambiar la forma de la vista.
drop function if exists public.get_feed(text[], text[], text[], text[], text[], text, int, int, text[]);

-- 2. feed_items: mismas columnas y orden, más 5 de autor AL FINAL.
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
  -- Ciudad: la de la marca; en looks de usuario, la del autor (solo si su perfil es público).
  coalesce(bcity.slug, au.city_slug) as city_slug,
  coalesce(bcity.name, au.city_name) as city_name,
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
  -- Categorías: de las prendas de catálogo y de las prendas propuestas (no rechazadas).
  coalesce((
    select array_agg(distinct c.slug) from (
      select cat2.slug from post_items it2
      join garment_tags gt2 on gt2.garment_id = it2.garment_id
      join tags cat2 on cat2.id = gt2.tag_id and cat2.type = 'category'
      where it2.post_id = p.id
      union
      select pc.slug from post_proposed_items ppi
      join proposed_garments pg on pg.id = ppi.proposed_garment_id and pg.status <> 'rejected'
      join tags pc on pc.id = pg.category_tag_id
      where ppi.post_id = p.id
    ) c
  ), '{}') as categories,
  min(g.price_cop) as min_price,
  max(g.price_cop) as max_price,
  coalesce(array_agg(distinct g.price_range::text) filter (where g.price_range is not null), '{}') as price_ranges,
  p.popularity + 5.0 / (1 + extract(epoch from (now() - coalesce(p.published_at, p.created_at))) / 86400.0) as score,
  (select count(*) from post_likes pl where pl.post_id = p.id)::int as like_count,
  -- Colores: de las prendas de catálogo y de las propuestas.
  coalesce((
    select array_agg(distinct x.slug) from (
      select c.slug from post_items it2
      join garment_colors gc on gc.garment_id = it2.garment_id
      join colors c on c.id = gc.color_id
      where it2.post_id = p.id
      union
      select c.slug from post_proposed_items ppi
      join proposed_garments pg on pg.id = ppi.proposed_garment_id and pg.status <> 'rejected'
      join proposed_garment_colors pgc on pgc.proposed_garment_id = pg.id
      join colors c on c.id = pgc.color_id
      where ppi.post_id = p.id
    ) x
  ), '{}') as colors,
  p.author_type::text as author_type,
  p.author_user_id,
  au.handle       as author_handle,
  au.display_name as author_name,
  au.avatar_key   as author_avatar
from posts p
left join brands b on b.id = p.author_brand_id
left join cities bcity on bcity.id = b.city_id
left join public_profiles au on au.id = p.author_user_id
left join post_tags pt on pt.post_id = p.id
left join tags lt on lt.id = pt.tag_id
left join post_items it on it.post_id = p.id
left join garments g on g.id = it.garment_id and g.status = 'published'
where p.status = 'published' and (b.id is not null or p.author_type = 'user')
group by p.id, b.id, bcity.slug, bcity.name, au.id, au.handle, au.display_name, au.avatar_key, au.city_slug, au.city_name

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
  -- Ocasiones y estilos: los propios ∪ los heredados de looks. Los looks de usuario solo cuentan
  -- si la marca confirmó la etiqueta (FR-015, hallazgo H3).
  coalesce((
    select array_agg(distinct t.slug) from (
      select x.slug from garment_tags own join tags x on x.id = own.tag_id
      where own.garment_id = g.id and x.type = 'occasion'
      union
      select x.slug from post_items it
      join posts pp on pp.id = it.post_id and pp.status = 'published'
      join post_tags pt on pt.post_id = pp.id
      join tags x on x.id = pt.tag_id and x.type = 'occasion'
      where it.garment_id = g.id and (pp.author_type <> 'user' or it.is_brand_verified)
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
      where it.garment_id = g.id and (pp.author_type <> 'user' or it.is_brand_verified)
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
  ), '{}') as colors,
  'brand'::text  as author_type,
  null::uuid     as author_user_id,
  null::text     as author_handle,
  null::text     as author_name,
  null::text     as author_avatar
from garments g
join brands b on b.id = g.brand_id
left join cities city on city.id = b.city_id
left join garment_tags gt on gt.garment_id = g.id
left join tags cat on cat.id = gt.tag_id and cat.type = 'category'
where g.status = 'published'
group by g.id, b.id, city.slug, city.name;

grant select on feed_items to anon, authenticated, service_role;

-- 3. get_feed: misma firma; reparto por autor (marca o usuario) y "az" por el nombre mostrado.
create function public.get_feed(
  p_cities text[] default null,
  p_occasions text[] default null,
  p_styles text[] default null,
  p_categories text[] default null,
  p_prices text[] default null,
  p_sort text default 'relevant',
  p_limit int default 24,
  p_offset int default 0,
  p_colors text[] default null
)
returns setof feed_items
language sql stable
as $$
  with filtered as (
    select f.*,
           row_number() over (partition by coalesce(f.brand_id, f.author_user_id)
                              order by f.score desc nulls last, f.id) as brand_rank
    from feed_items f
    where (p_cities is null or f.city_slug = any(p_cities))
      and (p_occasions is null or f.occasions && p_occasions)
      and (p_styles is null or f.styles && p_styles)
      and (p_categories is null or f.categories && p_categories)
      and (p_prices is null or f.price_ranges && p_prices)
      and (p_colors is null or f.colors && p_colors)
  )
  select f.kind, f.id, f.title, f.popularity, f.published_at, f.created_at,
         f.brand_id, f.brand_name, f.brand_slug, f.brand_verified,
         f.city_slug, f.city_name, f.image, f.image_width, f.image_height,
         f.occasions, f.styles, f.categories, f.min_price, f.max_price,
         f.price_ranges, f.score, f.like_count, f.colors,
         f.author_type, f.author_user_id, f.author_handle, f.author_name, f.author_avatar
  from filtered f
  order by
    (case when p_sort = 'new' then f.published_at end) desc nulls last,
    (case when p_sort = 'popular' then f.popularity end) desc nulls last,
    (case when p_sort = 'az' then coalesce(f.brand_name, f.author_name) end) asc nulls last,
    (case when p_sort is null or p_sort = 'relevant'
          then greatest(f.brand_rank - floor(coalesce(f.popularity, 0) / 3), 1) end) asc,
    (case when p_sort is null or p_sort = 'relevant'
          then md5(f.id::text || current_date::text) end),
    f.id
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.get_feed(text[], text[], text[], text[], text[], text, int, int, text[])
  to anon, authenticated, service_role;

-- 4. search_posts: incluye looks de usuario; busca también por autor, marcas mencionadas y prendas
--    propuestas. Misma firma.
create or replace function public.search_posts(q text default null, p_user_city uuid default null)
returns table (id uuid, sim real, same_city boolean)
language sql stable
as $$
  with norm as (select nullif(btrim(coalesce(q,'')), '') as qq),
  doc as (
    select p.id, b.city_id,
      public.f_unaccent(lower(
        coalesce(p.caption,'') || ' ' || coalesce(b.name,'') || ' ' ||
        coalesce(au.handle,'') || ' ' || coalesce(au.display_name,'') || ' ' ||
        coalesce((select string_agg(t.name, ' ') from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = p.id), '') || ' ' ||
        coalesce((select string_agg(coalesce(mb.name, ms.name), ' ')
                  from post_brand_mentions m
                  left join brands mb on mb.id = m.brand_id and mb.is_active
                  left join brand_stubs ms on ms.id = m.brand_stub_id and ms.status <> 'blocked'
                  where m.post_id = p.id), '') || ' ' ||
        coalesce((select string_agg(pg.name, ' ')
                  from post_proposed_items ppi
                  join proposed_garments pg on pg.id = ppi.proposed_garment_id and pg.status <> 'rejected'
                  where ppi.post_id = p.id), '')
      )) as txt
    from posts p
    left join brands b on b.id = p.author_brand_id
    left join public_profiles au on au.id = p.author_user_id
    where p.status = 'published' and (b.is_active or p.author_type = 'user')
  )
  select d.id,
    case when (select qq from norm) is null then 0::real
         else extensions.similarity(d.txt, public.f_unaccent(lower((select qq from norm)))) end as sim,
    (p_user_city is not null and d.city_id = p_user_city) as same_city
  from doc d
  where (select qq from norm) is null or public.search_matches(d.txt, (select qq from norm));
$$;

grant execute on function public.search_posts(text, uuid) to anon, authenticated;

commit;
