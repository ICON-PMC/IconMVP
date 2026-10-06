-- Búsqueda con términos cercanos: sinónimos curados + palabras de relleno, y los tags de
-- marcas y prendas dentro del texto de búsqueda.
-- Spec: specs/2026-10-06-etiquetas-ciudades-busqueda/plan.md, 1c y 1f.
--
-- Regla de coincidencia (public.search_matches): cada palabra útil de la consulta debe
-- coincidir con el texto, sea
--   - la palabra tal cual: subcadena o word_similarity >= 0.4 (lo de siempre), o
--   - alguno de sus sinónimos: como palabra completa (con plural opcional). Más estricto a
--     propósito: "cap" no debe encontrar "capucha" ni "mono" a "monocromo".

-- ============================================================
-- Tablas
-- ============================================================
create table search_synonyms (
  id          uuid primary key default gen_random_uuid(),
  terms       text[] not null,
  created_at  timestamptz not null default now()
);
create index search_synonyms_terms_idx on search_synonyms using gin (terms);

create table search_stopwords (
  word  text primary key
);

-- Normaliza a minúsculas sin acentos y solo [a-z0-9-] para que la búsqueda no tenga que
-- hacerlo, y para que un término sea seguro dentro de una regex.
create or replace function public.normalize_search_word(p text)
returns text language sql immutable parallel safe as $$
  select nullif(regexp_replace(public.f_unaccent(lower(btrim(coalesce(p, '')))), '[^a-z0-9-]+', '', 'g'), '')
$$;

create or replace function public.normalize_search_synonyms()
returns trigger language plpgsql set search_path = public as $$
begin
  new.terms := array(
    select distinct w from (select public.normalize_search_word(x) as w from unnest(new.terms) x) s
    where w is not null order by w
  );
  if cardinality(new.terms) < 2 then
    raise exception 'Un grupo de sinónimos necesita al menos dos palabras.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

create trigger search_synonyms_normalize
  before insert or update on search_synonyms
  for each row execute function public.normalize_search_synonyms();

create or replace function public.normalize_search_stopword()
returns trigger language plpgsql set search_path = public as $$
begin
  new.word := public.normalize_search_word(new.word);
  if new.word is null then
    raise exception 'La palabra está vacía.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

create trigger search_stopwords_normalize
  before insert or update on search_stopwords
  for each row execute function public.normalize_search_stopword();

-- RLS + GRANT: lectura pública (las RPC de búsqueda son security invoker), escritura staff.
alter table search_synonyms  enable row level security;
alter table search_stopwords enable row level security;

create policy search_synonyms_read  on search_synonyms  for select to anon, authenticated using (true);
create policy search_stopwords_read on search_stopwords for select to anon, authenticated using (true);
create policy search_synonyms_staff_all  on search_synonyms  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy search_stopwords_staff_all on search_stopwords for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

grant select on search_synonyms, search_stopwords to anon, authenticated;
grant insert, update, delete on search_synonyms, search_stopwords to authenticated;

-- ============================================================
-- Semilla
-- ============================================================
insert into search_synonyms (terms) values
  (array['hoodie', 'hoody', 'capucha', 'buzo', 'sudadera']),
  (array['jean', 'jeans', 'denim', 'vaquero']),
  (array['camiseta', 'tshirt', 't-shirt', 'playera', 'remera']),
  (array['chaqueta', 'jacket', 'chamarra', 'campera']),
  (array['tenis', 'sneakers', 'zapatillas']),
  (array['zapatos', 'calzado', 'shoes']),
  (array['vestido', 'dress']),
  (array['falda', 'skirt']),
  (array['pantalon', 'pants', 'trousers']),
  (array['bolso', 'cartera', 'bag']),
  (array['bikini', 'swimwear', 'banador']),
  (array['blusa', 'blouse']),
  (array['abrigo', 'coat']),
  (array['saco', 'sueter', 'sweater', 'jersey']),
  (array['shorts', 'short', 'pantaloneta', 'bermuda']),
  (array['gorra', 'cap']),
  (array['enterizo', 'jumpsuit', 'overol', 'mono']),
  (array['tropical', 'tropicales', 'caribe', 'caribeno', 'playero']);

insert into search_stopwords (word) values
  ('marca'), ('marcas'), ('brand'), ('brands'), ('ropa'),
  ('de'), ('del'), ('la'), ('las'), ('el'), ('los'), ('un'), ('una'),
  ('con'), ('para'), ('y'), ('en'),
  ('estilo'), ('inspirado'), ('inspirada'), ('inspired'), ('style')
on conflict do nothing;

-- ============================================================
-- Términos de una consulta y regla de coincidencia
-- ============================================================
-- Una fila por palabra útil: la palabra normalizada y sus sinónimos (sin ella misma).
-- Un grupo aplica si contiene la palabra o su singular simple ("hoodies" -> "hoodie").
-- Si todas las palabras son de relleno ("de la"), se usan tal cual en vez de no filtrar nada.
create or replace function public.search_terms(q text)
returns table (tok text, alts text[])
language sql stable set search_path = public as $$
  with toks as (
    select distinct public.normalize_search_word(t) as tok
    from regexp_split_to_table(coalesce(q, ''), '\s+') t
  ),
  useful as (
    select tok from toks
    where tok is not null and tok not in (select word from search_stopwords)
  ),
  chosen as (
    select tok from useful
    union all
    select tok from toks where tok is not null and not exists (select 1 from useful)
  )
  select c.tok,
    coalesce((
      select array_agg(distinct a) from search_synonyms s, unnest(s.terms) a
      where s.terms && array[c.tok, regexp_replace(c.tok, 'es$', ''), regexp_replace(c.tok, 's$', '')]
        and a <> c.tok
    ), '{}')
  from chosen c;
$$;

create or replace function public.search_matches(p_txt text, q text)
returns boolean
language sql stable set search_path = public as $$
  select not exists (
    select 1 from public.search_terms(q) t
    where not (
      p_txt like '%' || t.tok || '%'
      or extensions.word_similarity(t.tok, p_txt) >= 0.4
      or exists (select 1 from unnest(t.alts) a where p_txt ~ ('\m' || a || '(s|es)?\M'))
    )
  );
$$;

-- ============================================================
-- RPCs de búsqueda (mismas firmas salvo search_brands, que gana p_styles)
-- ============================================================
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
  with norm as (select nullif(btrim(coalesce(q,'')), '') as qq),
  doc as (
    select g.*, b.name as b_name, b.slug as b_slug, b.city_id as b_city_id,
      g.search_text || ' ' || public.f_unaccent(lower(coalesce(
        (select string_agg(t.name, ' ') from garment_tags gt join tags t on t.id = gt.tag_id
         where gt.garment_id = g.id), ''))) as txt
    from garments g
    join brands b on b.id = g.brand_id and b.is_active
    where g.status = 'published'
  )
  select
    d.id, d.title, d.price_cop,
    d.brand_id, d.b_name as brand_name, d.b_slug as brand_slug,
    city.slug as city_slug, city.name as city_name,
    (select gi.cf_image_id from garment_images gi where gi.garment_id = d.id order by gi.position limit 1) as image,
    d.popularity::integer,
    case when (select qq from norm) is null then 0::real
         else extensions.similarity(d.txt, public.f_unaccent(lower((select qq from norm)))) end as sim
  from doc d
  left join cities city on city.id = d.b_city_id
  where ( (select qq from norm) is null or public.search_matches(d.txt, (select qq from norm)) )
    and ( p_cities is null or city.slug = any(p_cities) )
    and ( p_prices is null or d.price_range::text = any(p_prices) )
    and ( p_categories is null or exists (
            select 1 from garment_tags gt join tags t on t.id = gt.tag_id
            where gt.garment_id = d.id and t.type = 'category' and t.slug = any(p_categories)) )
  order by
    (case when p_sort = 'az' then d.title end) asc nulls last,
    (case when p_sort = 'new' then d.published_at end) desc nulls last,
    (case when p_sort = 'popular' then d.popularity end) desc nulls last,
    (case when (p_sort is null or p_sort = 'relevant') and p_user_city is not null and d.b_city_id = p_user_city then 1 else 0 end) desc,
    (case when (p_sort is null or p_sort = 'relevant') then
        (case when (select qq from norm) is null then 0::real
              else extensions.similarity(d.txt, public.f_unaccent(lower((select qq from norm)))) end)
     end) desc nulls last,
    d.popularity desc,
    d.published_at desc nulls last
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
  where (select qq from norm) is null or public.search_matches(d.txt, (select qq from norm));
$$;

-- Cambia la firma (p_styles): se borra la anterior para no dejar dos sobrecargas.
drop function if exists public.search_brands(text, uuid);

create or replace function public.search_brands(
  q text default null,
  p_user_city uuid default null,
  p_styles text[] default null
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
        coalesce((select string_agg(t0.name, ' ') from brand_tags bt join tags t0 on t0.id = bt.tag_id where bt.brand_id = b.id), '') || ' ' ||
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
  where ( (select qq from norm) is null or public.search_matches(d.txt, (select qq from norm)) )
    and ( p_styles is null or exists (
            select 1 from brand_tags bt join tags t on t.id = bt.tag_id
            where bt.brand_id = d.id and t.slug = any(p_styles)) );
$$;
