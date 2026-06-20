-- Mejora de recall en las búsquedas: además de subcadena (LIKE), un token matchea si su
-- word_similarity con el texto es >= 0.4. Así "abrigos" encuentra "Abrigo lana niebla"
-- (plural/inflexión/typos) sin meter ruido (en los datos el corte 0.4 separa 0.73+ de <=0.22).
-- CREATE OR REPLACE de las 3 RPCs (aplicado a la nube por el MCP).

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
  with norm as (select nullif(btrim(coalesce(q,'')), '') as qq)
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
            select 1 from regexp_split_to_table((select qq from norm), '\s+') as t
            where length(t) > 0
              and g.search_text not like '%' || public.f_unaccent(lower(t)) || '%'
              and extensions.word_similarity(public.f_unaccent(lower(t)), g.search_text) < 0.4
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

create or replace function public.search_posts(q text default null, p_user_city uuid default null)
returns table (id uuid, sim real, same_city boolean)
language sql stable
as $$
  with norm as (select nullif(btrim(coalesce(q,'')), '') as qq),
  doc as (
    select p.id, b.city_id,
      public.f_unaccent(lower(
        coalesce(p.caption,'') || ' ' || coalesce(b.name,'') || ' ' ||
        coalesce((select string_agg(t.name, ' ') from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = p.id), '')
      )) as txt
    from posts p join brands b on b.id = p.author_brand_id and b.is_active
    where p.status = 'published'
  )
  select d.id,
    case when (select qq from norm) is null then 0::real
         else extensions.similarity(d.txt, public.f_unaccent(lower((select qq from norm)))) end as sim,
    (p_user_city is not null and d.city_id = p_user_city) as same_city
  from doc d
  where (select qq from norm) is null
     or not exists (
       select 1 from regexp_split_to_table((select qq from norm), '\s+') tok
       where length(tok) > 0
         and d.txt not like '%' || public.f_unaccent(lower(tok)) || '%'
         and extensions.word_similarity(public.f_unaccent(lower(tok)), d.txt) < 0.4
     );
$$;

create or replace function public.search_brands(q text default null, p_user_city uuid default null)
returns table (
  id uuid, slug text, name text, bio text, city_name text,
  is_verified boolean, is_sustainable boolean, logo_url text,
  garments integer, created_at timestamptz, sim real, same_city boolean
)
language sql stable
as $$
  with norm as (select nullif(btrim(coalesce(q,'')), '') as qq),
  doc as (
    select b.id, b.slug, b.name, b.bio, b.is_verified, b.is_sustainable, b.logo_url,
      b.city_id, b.created_at, city.name as city_name,
      (select count(*) from garments g where g.brand_id = b.id and g.status = 'published')::int as garments,
      public.f_unaccent(lower(
        coalesce(b.name,'') || ' ' || coalesce(b.bio,'') || ' ' ||
        coalesce((select string_agg(distinct t.name, ' ') from garments g join garment_tags gt on gt.garment_id = g.id join tags t on t.id = gt.tag_id where g.brand_id = b.id), '') || ' ' ||
        coalesce((select string_agg(distinct t2.name, ' ') from posts p join post_tags pt on pt.post_id = p.id join tags t2 on t2.id = pt.tag_id where p.author_brand_id = b.id), '')
      )) as txt
    from brands b left join cities city on city.id = b.city_id
    where b.is_active
  )
  select d.id, d.slug, d.name, d.bio, d.city_name, d.is_verified, d.is_sustainable,
    d.logo_url, d.garments, d.created_at,
    case when (select qq from norm) is null then 0::real
         else extensions.similarity(d.txt, public.f_unaccent(lower((select qq from norm)))) end as sim,
    (p_user_city is not null and d.city_id = p_user_city) as same_city
  from doc d
  where (select qq from norm) is null
     or not exists (
       select 1 from regexp_split_to_table((select qq from norm), '\s+') tok
       where length(tok) > 0
         and d.txt not like '%' || public.f_unaccent(lower(tok)) || '%'
         and extensions.word_similarity(public.f_unaccent(lower(tok)), d.txt) < 0.4
     );
$$;
