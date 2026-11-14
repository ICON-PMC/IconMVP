-- Colores como vocabulario abierto (spec 004-etiquetado-abierto-ia, FR-015 a FR-017).
--
-- Van en tablas propias y NO como un tipo más de `tags`: el código desplegado agrupa todas
-- las etiquetas por tipo (`getTagOptions`) y un tipo desconocido lo rompería mientras dev y
-- producción comparten la misma base. `garments.color` (texto) se mantiene y lo reescribe un
-- trigger con los nombres de los colores asignados, así la búsqueda (search_text) los encuentra
-- sin tocar las RPC de búsqueda.

-- ============================================================
-- colors
-- ============================================================
create table colors (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  name_key            text generated always as (regexp_replace(public.f_unaccent(lower(name)), '[^a-z0-9]', '', 'g')) stored,
  hex                 text check (hex is null or hex ~ '^#[0-9A-Fa-f]{6}$'),
  position            int not null default 1000,
  is_hidden           boolean not null default false,
  created_by_brand_id uuid references brands (id) on delete set null,
  created_by_user_id  uuid references users (id) on delete set null,
  created_at          timestamptz not null default now()
);
create unique index colors_name_key_idx on colors (name_key);

alter table colors enable row level security;
create policy colors_read on colors for select to anon, authenticated using (true);
create policy colors_staff_all on colors
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select on colors to anon, authenticated;
grant insert, update, delete on colors to authenticated;
grant all on colors to service_role;

-- Paleta base (piloto con Haiku 2026-11-14 + "Morado").
insert into colors (name, slug, hex, position) values
  ('Negro',       'negro',       '#111111', 10),
  ('Blanco',      'blanco',      '#FFFFFF', 20),
  ('Crudo',       'crudo',       '#F3EBDD', 30),
  ('Beige',       'beige',       '#D9C3A0', 40),
  ('Camel',       'camel',       '#C19A6B', 50),
  ('Café',        'cafe',        '#6B4428', 60),
  ('Gris',        'gris',        '#8C8C8C', 70),
  ('Azul oscuro', 'azul-oscuro', '#1F2A4D', 80),
  ('Azul',        'azul',        '#2F5DA8', 90),
  ('Celeste',     'celeste',     '#9CC9EB', 100),
  ('Verde',       'verde',       '#3E8E4E', 110),
  ('Verde oliva', 'verde-oliva', '#6B7536', 120),
  ('Amarillo',    'amarillo',    '#F2CF3A', 130),
  ('Naranja',     'naranja',     '#E8782A', 140),
  ('Rojo',        'rojo',        '#C62F2F', 150),
  ('Vino',        'vino',        '#6E1F2B', 160),
  ('Rosado',      'rosado',      '#F2A7B8', 170),
  ('Fucsia',      'fucsia',      '#D6247A', 180),
  ('Lila',        'lila',        '#C6A4DE', 190),
  ('Morado',      'morado',      '#6B3FA0', 200),
  ('Dorado',      'dorado',      '#C9A24B', 210),
  ('Plateado',    'plateado',    '#BFC3C7', 220),
  ('Multicolor',  'multicolor',  null,      230),
  ('Estampado',   'estampado',   null,      240);

-- ============================================================
-- garment_colors (máx. 3 por prenda)
-- ============================================================
create table garment_colors (
  garment_id uuid not null references garments (id) on delete cascade,
  color_id   uuid not null references colors (id) on delete cascade,
  primary key (garment_id, color_id)
);
create index garment_colors_color_idx on garment_colors (color_id);

create or replace function public.check_garment_color()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from garment_colors where garment_id = new.garment_id and color_id <> new.color_id) >= 3 then
    raise exception 'La prenda ya tiene el máximo de 3 colores.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
create trigger garment_colors_check
  before insert or update on garment_colors
  for each row execute function public.check_garment_color();

-- garments.color = nombres de sus colores (para búsqueda y para el código que aún lee el texto).
create or replace function public.sync_garment_color_text()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  gid uuid := coalesce(new.garment_id, old.garment_id);
begin
  update garments g set color = (
    select string_agg(c.name, ', ' order by c.position, c.name)
    from garment_colors gc join colors c on c.id = gc.color_id
    where gc.garment_id = gid
  )
  where g.id = gid;
  return null;
end; $$;
create trigger garment_colors_sync_text
  after insert or update or delete on garment_colors
  for each row execute function public.sync_garment_color_text();

alter table garment_colors enable row level security;
create policy garment_colors_read on garment_colors for select to anon, authenticated using (true);
create policy garment_colors_owner_all on garment_colors
  for all to authenticated
  using (exists (select 1 from garments g where g.id = garment_id and public.is_brand_owner(g.brand_id)))
  with check (exists (select 1 from garments g where g.id = garment_id and public.is_brand_owner(g.brand_id)));
create policy garment_colors_staff_all on garment_colors
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select on garment_colors to anon, authenticated;
grant insert, update, delete on garment_colors to authenticated;
grant all on garment_colors to service_role;

-- ============================================================
-- create_color: crea (o devuelve) un color. Marcas y equipo; mismas reglas que los estilos.
-- ============================================================
create or replace function public.create_color(p_name text)
returns setof colors
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
  my_brand uuid := (select b.id from brands b where b.owner_user_id = me order by b.created_at limit 1);
  k text := regexp_replace(public.f_unaccent(lower(coalesce(p_name, ''))), '[^a-z0-9]', '', 'g');
  existing colors;
  err text;
begin
  if me is null or not (public.is_staff() or my_brand is not null) then
    raise exception 'Solo marcas y el equipo pueden crear colores.' using errcode = 'insufficient_privilege';
  end if;
  select * into existing from colors where name_key = k;
  if found then
    if existing.is_hidden then
      raise exception 'Ese color no está disponible.' using errcode = 'check_violation';
    end if;
    return next existing;
    return;
  end if;
  err := public.vocab_name_error(p_name);
  if err is not null then
    raise exception '%', replace(err, 'estilo', 'color') using errcode = 'check_violation';
  end if;
  return query
    insert into colors (name, slug, created_by_brand_id, created_by_user_id)
    values (
      btrim(regexp_replace(p_name, '\s+', ' ', 'g')),
      public.vocab_slug(p_name, array(select slug from colors)),
      case when public.is_staff() then null else my_brand end,
      me
    )
    returning *;
end; $$;
revoke execute on function public.create_color(text) from public, anon;
grant execute on function public.create_color(text) to authenticated;

-- ============================================================
-- feed_items: nueva columna `colors` AL FINAL (create or replace view solo puede agregar al
-- final). get_feed devuelve el tipo de la vista, así que se borra antes y se recrea después
-- con el filtro p_colors (default null: las llamadas actuales sin p_colors siguen sirviendo).
-- ============================================================
drop function if exists public.get_feed(text[], text[], text[], text[], text[], text, int, int);

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
  null::integer as image_width,
  null::integer as image_height,
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

create or replace function public.get_feed(
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
           row_number() over (partition by f.brand_id order by f.score desc nulls last, f.id) as brand_rank
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
         f.price_ranges, f.score, f.like_count, f.colors
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

grant execute on function public.get_feed(text[], text[], text[], text[], text[], text, int, int, text[])
  to anon, authenticated;

-- Colores con prendas publicadas (para el filtro del feed), con su uso.
create or replace function public.color_filter_options()
returns table (slug text, name text, hex text, uses int)
language sql stable as $$
  select c.slug, c.name, c.hex, count(*)::int
  from colors c
  join garment_colors gc on gc.color_id = c.id
  join garments g on g.id = gc.garment_id and g.status = 'published'
  join brands b on b.id = g.brand_id and b.is_active
  where not c.is_hidden
  group by c.id
  order by min(c.position), c.name;
$$;
grant execute on function public.color_filter_options() to anon, authenticated;
