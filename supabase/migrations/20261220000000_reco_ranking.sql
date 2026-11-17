-- Spec 003, migración B: feed personalizado ("Para ti"), filtros de talla, marca y precio libre, y
-- contadores por filtro.
--
-- ⚠️ Cambia `feed_items` y `get_feed`, que usa producción. Requiere la migración C de la 008. Los
-- parámetros nuevos de get_feed tienen valor por defecto: las llamadas actuales por nombre siguen
-- funcionando. Aplicar a la nube antes del código que usa get_feed_for_me / feed_facets.
--
-- Bases (última versión aplicada):
--   feed_items ← 20261120020000_feed_user_looks.sql (+ 2 columnas AL FINAL: sizes, brand_slugs)
--   get_feed   ← 20261120020000_feed_user_looks.sql (+ p_sizes, p_brands, p_price_min, p_price_max)
-- Dependientes que siguen igual: profile_liked y get_following_feed (009) devuelven `setof feed_items`
-- con `select f.*`; search_by_embedding, similar_garments y feed_style_counts usan columnas por nombre.

begin;

drop function if exists public.get_feed(text[], text[], text[], text[], text[], text, int, int, text[]);
drop function if exists public.get_feed(text[], text[], text[], text[], text[], text, int, int, text[], text[], text[], int, int);

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
  au.avatar_key   as author_avatar,
  -- Spec 003: tallas de las prendas de catálogo del look y marcas (autora + de sus prendas).
  coalesce((
    select array_agg(distinct s.label) from post_items it3
    join garment_sizes gs on gs.garment_id = it3.garment_id
    join sizes s on s.id = gs.size_id
    where it3.post_id = p.id
  ), '{}') as sizes,
  coalesce((
    select array_agg(distinct x.slug) from (
      select b.slug where b.slug is not null
      union
      select gb.slug from post_items it4
      join garments g4 on g4.id = it4.garment_id and g4.status = 'published'
      join brands gb on gb.id = g4.brand_id and gb.is_active
      where it4.post_id = p.id
    ) x
  ), '{}') as brand_slugs
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
  null::text     as author_avatar,
  coalesce((
    select array_agg(s.label order by s.sort_order) from garment_sizes gs
    join sizes s on s.id = gs.size_id
    where gs.garment_id = g.id
  ), '{}') as sizes,
  array[b.slug] as brand_slugs
from garments g
join brands b on b.id = g.brand_id
left join cities city on city.id = b.city_id
left join garment_tags gt on gt.garment_id = g.id
left join tags cat on cat.id = gt.tag_id and cat.type = 'category'
where g.status = 'published'
group by g.id, b.id, city.slug, city.name;

grant select on feed_items to anon, authenticated, service_role;

-- ============================================================
-- Filtro común: ¿cumple el ítem los filtros? `p_skip` omite un grupo (para los contadores).
-- ============================================================
create or replace function public._feed_match(
  f feed_items,
  p_cities text[], p_occasions text[], p_styles text[], p_categories text[], p_prices text[], p_colors text[],
  p_sizes text[], p_brands text[], p_price_min int, p_price_max int, p_skip text default null)
returns boolean language sql immutable as $$
  select (p_skip = 'city' or p_cities is null or f.city_slug = any(p_cities))
     and (p_skip = 'occasion' or p_occasions is null or f.occasions && p_occasions)
     and (p_skip = 'style' or p_styles is null or f.styles && p_styles)
     and (p_skip = 'category' or p_categories is null or f.categories && p_categories)
     and (p_skip = 'price' or p_prices is null or f.price_ranges && p_prices)
     and (p_skip = 'price' or p_price_min is null or f.max_price >= p_price_min)
     and (p_skip = 'price' or p_price_max is null or f.min_price <= p_price_max)
     and (p_skip = 'color' or p_colors is null or f.colors && p_colors)
     and (p_skip = 'size' or p_sizes is null or f.sizes && p_sizes)
     and (p_skip = 'brand' or p_brands is null or f.brand_slugs && p_brands)
$$;
grant execute on function public._feed_match(feed_items, text[], text[], text[], text[], text[], text[], text[], text[], int, int, text)
  to anon, authenticated, service_role;

-- ============================================================
-- get_feed: misma lógica + filtros nuevos (por defecto nulos).
-- ============================================================
create function public.get_feed(
  p_cities text[] default null,
  p_occasions text[] default null,
  p_styles text[] default null,
  p_categories text[] default null,
  p_prices text[] default null,
  p_sort text default 'relevant',
  p_limit int default 24,
  p_offset int default 0,
  p_colors text[] default null,
  p_sizes text[] default null,
  p_brands text[] default null,
  p_price_min int default null,
  p_price_max int default null
)
returns setof feed_items
language sql stable
as $$
  with filtered as (
    select f.*,
           row_number() over (partition by coalesce(f.brand_id, f.author_user_id)
                              order by f.score desc nulls last, f.id) as brand_rank
    from feed_items f
    where public._feed_match(f, p_cities, p_occasions, p_styles, p_categories, p_prices, p_colors,
                             p_sizes, p_brands, p_price_min, p_price_max)
  )
  select f.kind, f.id, f.title, f.popularity, f.published_at, f.created_at,
         f.brand_id, f.brand_name, f.brand_slug, f.brand_verified,
         f.city_slug, f.city_name, f.image, f.image_width, f.image_height,
         f.occasions, f.styles, f.categories, f.min_price, f.max_price,
         f.price_ranges, f.score, f.like_count, f.colors,
         f.author_type, f.author_user_id, f.author_handle, f.author_name, f.author_avatar,
         f.sizes, f.brand_slugs
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
grant execute on function public.get_feed(text[], text[], text[], text[], text[], text, int, int, text[], text[], text[], int, int)
  to anon, authenticated, service_role;

-- ============================================================
-- Perfil de gusto (research R2): calculado al vuelo, normalizado 0–1 por dimensión.
-- ============================================================
create or replace function public._my_taste(p_user uuid, p_as_of timestamptz default now())
returns table (dim text, key text, weight real)
language sql stable security definer set search_path = public as $$
  with s as (select * from reco_settings where id = 1),
  -- Señales sobre ítems, con decaimiento exponencial (media vida en días).
  item_signals as (
    select x.kind, x.id, x.w * exp(-ln(2) * greatest(extract(epoch from (p_as_of - x.at)) / 86400.0, 0) / s.half_life_days) as w
    from s, (
      select 'garment'::text kind, oc.garment_id id, (select w_click from s) w, oc.created_at at
        from outbound_clicks oc where oc.user_id = p_user and oc.garment_id is not null and oc.created_at <= p_as_of
      union all
      select 'post', oc.post_id, (select w_click from s), oc.created_at
        from outbound_clicks oc where oc.user_id = p_user and oc.garment_id is null and oc.post_id is not null and oc.created_at <= p_as_of
      union all
      select 'garment', sg.garment_id, (select w_save from s), sg.created_at from saved_garments sg where sg.user_id = p_user and sg.created_at <= p_as_of
      union all
      select 'post', sp.post_id, (select w_save from s), sp.created_at from saved_posts sp where sp.user_id = p_user and sp.created_at <= p_as_of
      union all
      select 'garment', gl.garment_id, (select w_like from s), gl.created_at from garment_likes gl where gl.user_id = p_user and gl.created_at <= p_as_of
      union all
      select 'post', pl.post_id, (select w_like from s), pl.created_at from post_likes pl where pl.user_id = p_user and pl.created_at <= p_as_of
      union all
      select e.item_kind::text, e.item_id, (select w_view from s), e.created_at from interaction_events e
       where e.user_id = p_user and e.kind = 'detail_view' and e.item_kind in ('garment', 'post') and e.created_at <= p_as_of
    ) x
  ),
  per_item as (select kind, id, sum(w) w from item_signals group by kind, id),
  -- Cada señal reparte su peso entre las etiquetas del ítem en cada dimensión.
  raw as (
    select 'style'::text dim, t.k key, pi.w / greatest(cardinality(f.styles), 1) w
      from per_item pi join feed_items f on f.kind = pi.kind and f.id = pi.id, unnest(f.styles) t(k)
    union all
    select 'occasion', t.k, pi.w / greatest(cardinality(f.occasions), 1)
      from per_item pi join feed_items f on f.kind = pi.kind and f.id = pi.id, unnest(f.occasions) t(k)
    union all
    select 'category', t.k, pi.w / greatest(cardinality(f.categories), 1)
      from per_item pi join feed_items f on f.kind = pi.kind and f.id = pi.id, unnest(f.categories) t(k)
    union all
    select 'price', t.k, pi.w / greatest(cardinality(f.price_ranges), 1)
      from per_item pi join feed_items f on f.kind = pi.kind and f.id = pi.id, unnest(f.price_ranges) t(k)
    union all
    select 'brand', f.brand_slug, pi.w from per_item pi join feed_items f on f.kind = pi.kind and f.id = pi.id where f.brand_slug is not null
    union all
    select 'city', f.city_slug, pi.w from per_item pi join feed_items f on f.kind = pi.kind and f.id = pi.id where f.city_slug is not null
    union all
    select 'author', f.author_user_id::text, pi.w from per_item pi join feed_items f on f.kind = pi.kind and f.id = pi.id where f.author_user_id is not null
    union all
    -- Declarado (no decae): estilos del onboarding/ajustes y ciudad.
    select 'style', t.slug, s.w_declared_style from s, user_preferences up join tags t on t.id = up.tag_id and t.type = 'style' where up.user_id = p_user
    union all
    select 'city', c.slug, s.w_declared_city from s, users u join cities c on c.id = u.home_city_id where u.id = p_user
    union all
    -- Seguir (no decae mientras siga).
    select 'brand', b.slug, s.w_follow from s, brand_follows bf join brands b on b.id = bf.brand_id where bf.user_id = p_user and bf.created_at <= p_as_of
    union all
    select 'author', uf.followed_id::text, s.w_follow from s, user_follows uf where uf.follower_id = p_user and uf.created_at <= p_as_of
  ),
  agg as (select dim, key, sum(w) w from raw where key is not null group by dim, key)
  select dim, key, (w / max(w) over (partition by dim))::real from agg where w > 0
$$;
revoke execute on function public._my_taste(uuid, timestamptz) from public, anon, authenticated;

-- ============================================================
-- Feed "Para ti" (research R3): afinidad + calidad + novedad, ronda por marca, exploración 1 de cada
-- `explore_every`, orden estable con `p_as_of`.
-- ============================================================
create or replace function public.get_feed_for_me(
  p_cities text[] default null, p_occasions text[] default null, p_styles text[] default null,
  p_categories text[] default null, p_prices text[] default null, p_colors text[] default null,
  p_sizes text[] default null, p_brands text[] default null, p_price_min int default null, p_price_max int default null,
  p_limit int default 24, p_offset int default 0, p_as_of timestamptz default null)
returns table (
  kind text, id uuid, title text, popularity numeric, published_at timestamptz, created_at timestamptz,
  brand_id uuid, brand_name text, brand_slug text, brand_verified boolean, city_slug text, city_name text,
  image text, image_width int, image_height int, occasions text[], styles text[], categories text[],
  min_price int, max_price int, price_ranges text[], score numeric, like_count int, colors text[],
  author_type text, author_user_id uuid, author_handle text, author_name text, author_avatar text,
  sizes text[], brand_slugs text[], personalized boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
  as_of timestamptz := coalesce(p_as_of, now());
  st reco_settings;
begin
  select * into st from reco_settings where reco_settings.id = 1;
  if me is null or not exists (select 1 from public._my_taste(me, as_of)) then
    return query
      select g.*, false from public.get_feed(p_cities, p_occasions, p_styles, p_categories, p_prices, 'relevant',
                                             p_limit, p_offset, p_colors, p_sizes, p_brands, p_price_min, p_price_max) g;
    return;
  end if;

  return query
  with taste as (select * from public._my_taste(me, as_of)),
  items as (
    select f.* from feed_items f
    where public._feed_match(f, p_cities, p_occasions, p_styles, p_categories, p_prices, p_colors,
                             p_sizes, p_brands, p_price_min, p_price_max)
  ),
  scored as (
    select i.*,
      ( st.d_style    * coalesce((select max(t.weight) from taste t where t.dim = 'style' and t.key = any(i.styles)), 0)
      + st.d_category * coalesce((select max(t.weight) from taste t where t.dim = 'category' and t.key = any(i.categories)), 0)
      + st.d_brand    * coalesce((select max(t.weight) from taste t where t.dim = 'brand' and t.key = any(i.brand_slugs)), 0)
      + st.d_occasion * coalesce((select max(t.weight) from taste t where t.dim = 'occasion' and t.key = any(i.occasions)), 0)
      + st.d_author   * coalesce((select max(t.weight) from taste t where t.dim = 'author' and t.key = i.author_user_id::text), 0)
      + st.d_city     * coalesce((select max(t.weight) from taste t where t.dim = 'city' and t.key = i.city_slug), 0)
      + st.d_price    * coalesce((select max(t.weight) from taste t where t.dim = 'price' and t.key = any(i.price_ranges)), 0)
      ) / nullif(st.d_style + st.d_category + st.d_brand + st.d_occasion + st.d_author + st.d_city + st.d_price, 0) as affinity,
      percent_rank() over (order by i.popularity) as quality,
      1.0 / (1 + greatest(extract(epoch from (as_of - coalesce(i.published_at, i.created_at))), 0) / 86400.0 / 7) as recency
    from items i
  ),
  ranked as (
    select sc.*,
      st.mix_affinity * sc.affinity + st.mix_quality * sc.quality + st.mix_recency * sc.recency as total,
      (sc.affinity < 0.1 and sc.quality >= 0.667) as explore
    from scored sc
  ),
  grouped as (
    select r.*,
      row_number() over (partition by r.explore, coalesce(r.brand_id, r.author_user_id)
                         order by r.total desc, md5(r.id::text || as_of::date::text || me::text)) as brand_rank
    from ranked r
  ),
  ordered as (
    select gr.*,
      -- Ronda por marca; la afinidad adelanta las marcas preferidas (con afinidad 1, hasta ~3 por ronda).
      row_number() over (partition by gr.explore
                         order by ceil(gr.brand_rank / (1 + 2 * gr.affinity)), gr.total desc,
                                  md5(gr.id::text || as_of::date::text || me::text)) as n
    from grouped gr
  )
  select o.kind, o.id, o.title, o.popularity, o.published_at, o.created_at,
         o.brand_id, o.brand_name, o.brand_slug, o.brand_verified, o.city_slug, o.city_name,
         o.image, o.image_width, o.image_height, o.occasions, o.styles, o.categories,
         o.min_price, o.max_price, o.price_ranges, o.score, o.like_count, o.colors,
         o.author_type, o.author_user_id, o.author_handle, o.author_name, o.author_avatar,
         o.sizes, o.brand_slugs, true
  from ordered o
  order by
    case when o.explore then o.n * st.explore_every
         else o.n + floor((o.n - 1)::numeric / (st.explore_every - 1)) end,
    o.explore,
    o.id
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
end; $$;
revoke execute on function public.get_feed_for_me(text[], text[], text[], text[], text[], text[], text[], text[], int, int, int, int, timestamptz) from public, anon;
grant execute on function public.get_feed_for_me(text[], text[], text[], text[], text[], text[], text[], text[], int, int, int, int, timestamptz) to authenticated, service_role;

-- ============================================================
-- Contadores por filtro (FR-022): cada grupo cuenta con los demás filtros activos, sin el propio.
-- ============================================================
create or replace function public.feed_facets(
  p_cities text[] default null, p_occasions text[] default null, p_styles text[] default null,
  p_categories text[] default null, p_prices text[] default null, p_colors text[] default null,
  p_sizes text[] default null, p_brands text[] default null, p_price_min int default null, p_price_max int default null)
returns table (grp text, value text, n int)
language sql stable as $$
  with f as (select * from feed_items)
  select 'city', f.city_slug, count(*)::int from f
   where f.city_slug is not null and public._feed_match(f, p_cities, p_occasions, p_styles, p_categories, p_prices, p_colors, p_sizes, p_brands, p_price_min, p_price_max, 'city')
   group by 2
  union all
  select 'occasion', v, count(*)::int from f, unnest(f.occasions) v
   where public._feed_match(f, p_cities, p_occasions, p_styles, p_categories, p_prices, p_colors, p_sizes, p_brands, p_price_min, p_price_max, 'occasion') group by 2
  union all
  select 'style', v, count(*)::int from f, unnest(f.styles) v
   where public._feed_match(f, p_cities, p_occasions, p_styles, p_categories, p_prices, p_colors, p_sizes, p_brands, p_price_min, p_price_max, 'style') group by 2
  union all
  select 'category', v, count(*)::int from f, unnest(f.categories) v
   where public._feed_match(f, p_cities, p_occasions, p_styles, p_categories, p_prices, p_colors, p_sizes, p_brands, p_price_min, p_price_max, 'category') group by 2
  union all
  select 'price', v, count(*)::int from f, unnest(f.price_ranges) v
   where public._feed_match(f, p_cities, p_occasions, p_styles, p_categories, p_prices, p_colors, p_sizes, p_brands, p_price_min, p_price_max, 'price') group by 2
  union all
  select 'color', v, count(*)::int from f, unnest(f.colors) v
   where public._feed_match(f, p_cities, p_occasions, p_styles, p_categories, p_prices, p_colors, p_sizes, p_brands, p_price_min, p_price_max, 'color') group by 2
  union all
  select 'size', v, count(*)::int from f, unnest(f.sizes) v
   where public._feed_match(f, p_cities, p_occasions, p_styles, p_categories, p_prices, p_colors, p_sizes, p_brands, p_price_min, p_price_max, 'size') group by 2
  union all
  select 'brand', v, count(*)::int from f, unnest(f.brand_slugs) v
   where public._feed_match(f, p_cities, p_occasions, p_styles, p_categories, p_prices, p_colors, p_sizes, p_brands, p_price_min, p_price_max, 'brand') group by 2
$$;
revoke execute on function public.feed_facets(text[], text[], text[], text[], text[], text[], text[], text[], int, int) from public;
grant execute on function public.feed_facets(text[], text[], text[], text[], text[], text[], text[], text[], int, int) to anon, authenticated, service_role;

commit;
