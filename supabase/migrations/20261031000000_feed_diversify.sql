-- Feed "relevante" sin agrupar por tanda de carga.
-- Antes: score = popularidad + recencia, y con popularidad ~0 todo se ordenaba por fecha de subida,
-- así que una carga masiva de una marca ocupaba tarjetas seguidas. Ahora, en el orden por defecto:
--   1. se reparte en "rondas": la mejor prenda/outfit de cada marca va en la ronda 1, la segunda en la 2, etc.
--      (dentro de una marca sigue mandando el score);
--   2. cada guardado/clic ya acumulado (popularidad) adelanta un ítem una ronda por cada 3 puntos;
--   3. dentro de una ronda el orden es una mezcla estable que cambia cada día (md5 del id + fecha),
--      para que la paginación no repita ni se salte ítems y el feed no se vea igual todos los días.
-- Misma firma que antes (create or replace), así que no cambian los tipos ni los GRANT.
-- Los demás órdenes (new / popular / az) no cambian.

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
  with filtered as (
    select f.*,
           row_number() over (partition by f.brand_id order by f.score desc nulls last, f.id) as brand_rank
    from feed_items f
    where (p_cities is null or f.city_slug = any(p_cities))
      and (p_occasions is null or f.occasions && p_occasions)
      and (p_styles is null or f.styles && p_styles)
      and (p_categories is null or f.categories && p_categories)
      and (p_prices is null or f.price_ranges && p_prices)
  )
  select f.kind, f.id, f.title, f.popularity, f.published_at, f.created_at,
         f.brand_id, f.brand_name, f.brand_slug, f.brand_verified,
         f.city_slug, f.city_name, f.image, f.image_width, f.image_height,
         f.occasions, f.styles, f.categories, f.min_price, f.max_price,
         f.price_ranges, f.score, f.like_count
  from filtered f
  order by
    (case when p_sort = 'new' then f.published_at end) desc nulls last,
    (case when p_sort = 'popular' then f.popularity end) desc nulls last,
    (case when p_sort = 'az' then f.brand_name end) asc nulls last,
    (case when p_sort is null or p_sort = 'relevant'
          then greatest(f.brand_rank - floor(coalesce(f.popularity, 0) / 3), 1) end) asc,
    (case when p_sort is null or p_sort = 'relevant'
          then md5(f.id::text || current_date::text) end),
    f.id
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.get_feed(text[], text[], text[], text[], text[], text, int, int)
  to anon, authenticated;
