-- Buscador unificado: RPCs para posts (outfits) y marcas, mismo motor que prendas
-- (trigram + unaccent). Devuelven ids/datos + similitud + boost de ciudad; la app ordena.
-- (Aplicado a la nube por el MCP de Supabase; este archivo mantiene el repo en sync.)

-- Posts que matchean por caption + nombres de sus tags + nombre de la marca.
create or replace function public.search_posts(
  q text default null,
  p_user_city uuid default null
)
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
    from posts p
    join brands b on b.id = p.author_brand_id and b.is_active
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
       where length(tok) > 0 and d.txt not like '%' || public.f_unaccent(lower(tok)) || '%'
     );
$$;

-- Marcas que matchean por nombre + bio + tags derivados de su contenido (categorías de
-- sus prendas + tags de sus posts).
create or replace function public.search_brands(
  q text default null,
  p_user_city uuid default null
)
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
        coalesce((select string_agg(distinct t.name, ' ')
                  from garments g join garment_tags gt on gt.garment_id = g.id join tags t on t.id = gt.tag_id
                  where g.brand_id = b.id), '') || ' ' ||
        coalesce((select string_agg(distinct t2.name, ' ')
                  from posts p join post_tags pt on pt.post_id = p.id join tags t2 on t2.id = pt.tag_id
                  where p.author_brand_id = b.id), '')
      )) as txt
    from brands b
    left join cities city on city.id = b.city_id
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
       where length(tok) > 0 and d.txt not like '%' || public.f_unaccent(lower(tok)) || '%'
     );
$$;

grant execute on function public.search_posts(text, uuid) to anon, authenticated;
grant execute on function public.search_brands(text, uuid) to anon, authenticated;
