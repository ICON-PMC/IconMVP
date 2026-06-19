-- Búsqueda de prendas: trigram + unaccent (acentos, subcadenas, multi-palabra) y
-- RPC search_garments con ranking por similitud, boost de ciudad y orden configurable.
-- (Aplicado a la nube por el MCP de Supabase; este archivo mantiene el repo en sync.)

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Wrapper IMMUTABLE de unaccent (requisito para usarlo en una columna generada).
create or replace function public.f_unaccent(text)
returns text
language sql immutable parallel safe strict
as $$ select extensions.unaccent('extensions.unaccent', $1) $$;

-- Texto de búsqueda normalizado (sin acentos, minúsculas) sobre los campos de la prenda.
alter table garments
  add column if not exists search_text text
  generated always as (
    public.f_unaccent(lower(
      coalesce(title,'') || ' ' ||
      coalesce(description,'') || ' ' ||
      coalesce(color,'') || ' ' ||
      coalesce(fabric,'')
    ))
  ) stored;

create index if not exists garments_search_trgm
  on garments using gin (search_text extensions.gin_trgm_ops);

-- Búsqueda de prendas publicadas. q = texto; filtros por slug de ciudad/categoría y
-- bucket de precio (derivado de price_cop). p_sort: relevant|new|popular|az.
-- p_user_city (uuid) prioriza la ciudad de la usuaria en el orden 'relevant' sin excluir otras.
create or replace function public.search_garments(
  q text default null,
  p_cities text[] default null,
  p_categories text[] default null,
  p_prices text[] default null,
  p_sort text default 'relevant',
  p_user_city uuid default null
)
returns table (
  id uuid, title text, price_cop integer,
  brand_id uuid, brand_name text, brand_slug text,
  city_slug text, city_name text, image text,
  popularity integer, sim real
)
language sql stable
as $$
  with norm as (
    select nullif(btrim(coalesce(q,'')), '') as qq
  )
  select
    g.id, g.title, g.price_cop,
    b.id as brand_id, b.name as brand_name, b.slug as brand_slug,
    city.slug as city_slug, city.name as city_name,
    (select gi.cf_image_id from garment_images gi where gi.garment_id = g.id order by gi.position limit 1) as image,
    g.popularity,
    case when (select qq from norm) is null then 0::real
         else extensions.similarity(g.search_text, public.f_unaccent(lower((select qq from norm)))) end as sim
  from garments g
  join brands b on b.id = g.brand_id and b.is_active
  left join cities city on city.id = b.city_id
  where g.status = 'published'
    and ( (select qq from norm) is null
          or not exists (
            select 1
            from regexp_split_to_table((select qq from norm), '\s+') as t
            where length(t) > 0
              and g.search_text not like '%' || public.f_unaccent(lower(t)) || '%'
          ) )
    and ( p_cities is null or city.slug = any(p_cities) )
    and ( p_prices is null or
          (case when g.price_cop is null then null
                when g.price_cop < 100000 then 'under_100k'
                when g.price_cop < 200000 then '100k_200k'
                when g.price_cop < 350000 then '200k_350k'
                when g.price_cop < 500000 then '350k_500k'
                else 'over_500k' end) = any(p_prices) )
    and ( p_categories is null or exists (
            select 1 from garment_tags gt join tags t on t.id = gt.tag_id
            where gt.garment_id = g.id and t.type = 'category' and t.slug = any(p_categories)) )
  order by
    (case when p_sort = 'az' then g.title end) asc nulls last,
    (case when p_sort = 'new' then g.published_at end) desc nulls last,
    (case when p_sort = 'popular' then g.popularity end) desc nulls last,
    (case when (p_sort is null or p_sort = 'relevant') and p_user_city is not null and b.city_id = p_user_city then 1 else 0 end) desc,
    (case when (p_sort is null or p_sort = 'relevant') then
        (case when (select qq from norm) is null then 0::real
              else extensions.similarity(g.search_text, public.f_unaccent(lower((select qq from norm)))) end)
     end) desc nulls last,
    g.popularity desc,
    g.published_at desc nulls last
  limit 200;
$$;

grant execute on function public.search_garments(text, text[], text[], text[], text, uuid) to anon, authenticated;
