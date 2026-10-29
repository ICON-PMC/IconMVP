-- Etiquetas de marca (estilos) y etiquetas de prenda más allá de la categoría.
-- Spec: specs/2026-10-06-etiquetas-ciudades-busqueda/plan.md, 1a–1b.
--
-- Vocabulario fijo (`tags`), sin etiquetas libres (decisión 1):
--   brand_tags   -> solo `style`, máximo 5 por marca (decisión 2).
--   garment_tags -> 1 `category` + hasta 3 por tipo de `style`/`occasion`/`temperature` (decisión 3).

-- ============================================================
-- brand_tags
-- ============================================================
create table brand_tags (
  brand_id  uuid not null references brands (id) on delete cascade,
  tag_id    uuid not null references tags (id) on delete cascade,
  primary key (brand_id, tag_id)
);
create index brand_tags_tag_idx on brand_tags (tag_id);

create or replace function public.check_brand_tag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select type from tags where id = new.tag_id) <> 'style' then
    raise exception 'Una marca solo puede tener etiquetas de estilo.' using errcode = 'check_violation';
  end if;
  if (select count(*) from brand_tags where brand_id = new.brand_id and tag_id <> new.tag_id) >= 5 then
    raise exception 'Una marca puede tener como máximo 5 estilos.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

create trigger brand_tags_check
  before insert or update on brand_tags
  for each row execute function public.check_brand_tag();

-- RLS + GRANT en par (constitución §7.2). Mismo patrón que garment_tags.
alter table brand_tags enable row level security;

create policy brand_tags_read on brand_tags
  for select to anon, authenticated using (true);
create policy brand_tags_owner_all on brand_tags
  for all to authenticated
  using (public.is_brand_owner(brand_id))
  with check (public.is_brand_owner(brand_id));
create policy brand_tags_staff_all on brand_tags
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

grant select on brand_tags to anon, authenticated;
grant insert, update, delete on brand_tags to authenticated;

-- ============================================================
-- garment_tags: deja de ser solo la categoría
-- ============================================================
comment on table garment_tags is
  'Tags de la prenda: 1 category + hasta 3 por tipo de style/occasion/temperature.';

create or replace function public.check_garment_tag()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t tag_type := (select type from tags where id = new.tag_id);
  lim int := case when t = 'category' then 1 else 3 end;
begin
  if (select count(*) from garment_tags gt join tags x on x.id = gt.tag_id
      where gt.garment_id = new.garment_id and x.type = t and gt.tag_id <> new.tag_id) >= lim then
    raise exception 'La prenda ya tiene el máximo de etiquetas de tipo % (%).', t, lim
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

create trigger garment_tags_check
  before insert or update on garment_tags
  for each row execute function public.check_garment_tag();

-- ============================================================
-- feed_items: ocasiones y estilos de una prenda = los propios ∪ los heredados de sus posts
-- publicados. Se recrea la vista completa (misma lista de columnas); la rama de posts no cambia.
-- La rama de prendas deja los joins a post_items/post_tags y calcula los dos arreglos con
-- subconsultas, para no multiplicar filas al sumar un segundo join a garment_tags.
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
  null::integer as image_width,   -- garment_images no guarda dimensiones
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
  (select count(*) from garment_likes gl where gl.garment_id = g.id)::int as like_count
from garments g
join brands b on b.id = g.brand_id
left join cities city on city.id = b.city_id
left join garment_tags gt on gt.garment_id = g.id
left join tags cat on cat.id = gt.tag_id and cat.type = 'category'
where g.status = 'published'
group by g.id, b.id, city.slug, city.name;

grant select on feed_items to anon, authenticated;
