-- Marca con acceso propio: vincula users<->brands (reusa brands.owner_user_id, ya existía
-- sin usar), RLS para que cada marca solo vea/edite lo suyo, tabla de conexión a Instagram,
-- y protección para que una marca no pueda auto-verificarse ni reactivarse.

-- ============================================================
-- ¿El usuario autenticado es dueño de esta marca?
-- ============================================================
create or replace function public.is_brand_owner(p_brand_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.brands b
    where b.id = p_brand_id and b.owner_user_id = public.current_user_id()
  );
$$;

-- ============================================================
-- Protección: is_verified / is_active solo los cambia staff. Sin esto, una marca con
-- acceso propio podría auto-verificarse o reactivarse a sí misma vía su propia policy
-- de UPDATE. Silenciosamente preserva el valor anterior en vez de fallar (UX más simple
-- para la marca: el resto de su edición sí se guarda).
-- ============================================================
create or replace function public.protect_brand_curation_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    new.is_verified := old.is_verified;
    new.is_active := old.is_active;
  end if;
  return new;
end; $$;

create trigger brands_protect_curation_fields
  before update on brands
  for each row execute function public.protect_brand_curation_fields();

-- ============================================================
-- Fix de seguridad (no relacionado a marca, encontrado al revisar esta policy): la policy
-- `users_update_own` (init) no restringe columnas — cualquier usuaria autenticada podía
-- hacer PATCH directo a la API REST y ponerse `role: 'admin'` a sí misma, sin pasar por la
-- UI. El único self-service legítimo que necesitamos es 'user' -> 'brand' (conectar
-- Instagram); cualquier otro intento de cambiar el rol se ignora en silencio.
-- ============================================================
create or replace function public.protect_user_role_field()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    if not (old.role = 'user' and new.role = 'brand') then
      new.role := old.role;
    end if;
  end if;
  return new;
end; $$;

create trigger users_protect_role_field
  before update on users
  for each row execute function public.protect_user_role_field();

-- ============================================================
-- RLS: la marca gestiona lo suyo (mismo patrón que las policies de staff en
-- 20260614130000_roles_and_staff.sql, pero acotado por is_brand_owner en vez de is_staff).
-- Los GRANT de insert/update/delete sobre estas tablas para `authenticated` ya existen
-- desde esa migración; no hace falta repetirlos.
-- ============================================================
create policy brands_owner_all on brands
  for all to authenticated
  using (public.is_brand_owner(id))
  with check (public.is_brand_owner(id));

-- Policy aparte para el INSERT: is_brand_owner(id) busca una fila ya existente con ese id,
-- y en un INSERT esa fila todavía no es visible en su propio check (MVCC) — sin esto, una
-- usuaria nunca podría crear su primera marca. Aquí se compara directamente contra la
-- columna owner_user_id de la fila nueva, sin necesidad de mirar la tabla.
create policy brands_owner_insert on brands
  for insert to authenticated
  with check (owner_user_id = (select public.current_user_id()));

-- Policy aparte de SELECT, por el mismo motivo: `insert ... select("id")` (patrón usado en
-- todo el código de /admin) hace un RETURNING, que a su vez exige que la fila recién
-- insertada pase una policy de SELECT. `brands_owner_all` no sirve para ESE instante porque
-- is_brand_owner(id) mira la propia tabla brands y esa fila aún no es visible dentro del
-- mismo statement. Esta compara la columna directamente, sin ese problema de visibilidad.
create policy brands_owner_read on brands
  for select to authenticated
  using (owner_user_id = (select public.current_user_id()));

create policy garments_owner_all on garments
  for all to authenticated
  using (public.is_brand_owner(brand_id))
  with check (public.is_brand_owner(brand_id));

create policy garment_images_owner_all on garment_images
  for all to authenticated
  using (exists (
    select 1 from garments g where g.id = garment_id and public.is_brand_owner(g.brand_id)
  ))
  with check (exists (
    select 1 from garments g where g.id = garment_id and public.is_brand_owner(g.brand_id)
  ));

create policy garment_tags_owner_all on garment_tags
  for all to authenticated
  using (exists (
    select 1 from garments g where g.id = garment_id and public.is_brand_owner(g.brand_id)
  ))
  with check (exists (
    select 1 from garments g where g.id = garment_id and public.is_brand_owner(g.brand_id)
  ));

create policy garment_sizes_owner_all on garment_sizes
  for all to authenticated
  using (exists (
    select 1 from garments g where g.id = garment_id and public.is_brand_owner(g.brand_id)
  ))
  with check (exists (
    select 1 from garments g where g.id = garment_id and public.is_brand_owner(g.brand_id)
  ));

-- posts: solo posts de autoría 'brand' (el check constraint de posts ya obliga
-- author_type='brand' + author_brand_id cuando no es de usuaria).
create policy posts_owner_all on posts
  for all to authenticated
  using (author_brand_id is not null and public.is_brand_owner(author_brand_id))
  with check (author_brand_id is not null and public.is_brand_owner(author_brand_id));

create policy post_images_owner_all on post_images
  for all to authenticated
  using (exists (
    select 1 from posts p
    where p.id = post_id and p.author_brand_id is not null
      and public.is_brand_owner(p.author_brand_id)
  ))
  with check (exists (
    select 1 from posts p
    where p.id = post_id and p.author_brand_id is not null
      and public.is_brand_owner(p.author_brand_id)
  ));

-- post_items: la prenda taggeada debe ser del catálogo de la MISMA marca dueña del post
-- (una marca no puede taggear prendas de otra marca en su propio post).
create policy post_items_owner_all on post_items
  for all to authenticated
  using (exists (
    select 1 from posts p
    where p.id = post_id and p.author_brand_id is not null
      and public.is_brand_owner(p.author_brand_id)
  ))
  with check (exists (
    select 1 from posts p
    join garments g on g.id = garment_id
    where p.id = post_id
      and p.author_brand_id = g.brand_id
      and public.is_brand_owner(p.author_brand_id)
  ));

create policy post_tags_owner_all on post_tags
  for all to authenticated
  using (exists (
    select 1 from posts p
    where p.id = post_id and p.author_brand_id is not null
      and public.is_brand_owner(p.author_brand_id)
  ))
  with check (exists (
    select 1 from posts p
    where p.id = post_id and p.author_brand_id is not null
      and public.is_brand_owner(p.author_brand_id)
  ));

-- ============================================================
-- Conexión de Instagram de una marca (1 por marca). El access_token solo lo lee código
-- de servidor (server actions/route handlers); nunca se serializa de vuelta al cliente.
-- RLS restringe todo a la propia dueña; no hay policy de staff aquí a propósito (ni el
-- equipo necesita ver el token ajeno para depurar el MVP).
-- ============================================================
create table brand_instagram_connections (
  brand_id             uuid primary key references brands (id) on delete cascade,
  ig_user_id           text not null unique,
  username             text,
  account_type         text,
  access_token         text not null,
  token_expires_at     timestamptz not null,
  connected_by_user_id uuid references users (id) on delete set null,
  connected_at         timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger brand_instagram_connections_set_updated_at before update on brand_instagram_connections
  for each row execute function set_updated_at();

alter table brand_instagram_connections enable row level security;

create policy brand_instagram_connections_owner_all on brand_instagram_connections
  for all to authenticated
  using (public.is_brand_owner(brand_id))
  with check (public.is_brand_owner(brand_id));

grant select, insert, update, delete on brand_instagram_connections to authenticated;

-- ============================================================
-- Fix: post_feed no filtraba por brands.is_active (search_garments/search_posts/search_brands
-- sí lo hacen). Con el MVP curado esto casi nunca se notaba -staff no publicaba contenido de
-- una marca desactivada-, pero una marca con acceso propio arranca inactiva por diseño
-- (is_active=false hasta que staff la revisa) y SÍ puede publicar sus propios posts antes de
-- esa revisión: sin este fix, se colarían al feed público igual. Mismo criterio que ya usan
-- las 3 funciones de búsqueda.
-- ============================================================
create or replace view post_feed
with (security_invoker = true) as
select
  p.id,
  p.caption,
  p.popularity,
  p.published_at,
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
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'occasion'), '{}')     as occasions,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'style'), '{}')        as styles,
  coalesce(array_agg(distinct lt.slug) filter (where lt.type = 'temperature'), '{}')  as temperatures,
  coalesce(array_agg(distinct cat.slug) filter (where cat.slug is not null), '{}')    as categories,
  min(g.price_cop) as min_price,
  max(g.price_cop) as max_price,
  coalesce(array_agg(distinct g.price_range::text) filter (where g.price_range is not null), '{}') as price_ranges,
  p.popularity + 5.0 / (1 + extract(epoch from (now() - coalesce(p.published_at, p.created_at))) / 86400.0) as score
from posts p
join brands b on b.id = p.author_brand_id and b.is_active
left join cities city on city.id = b.city_id
left join post_tags pt on pt.post_id = p.id
left join tags lt on lt.id = pt.tag_id
left join post_items it on it.post_id = p.id
left join garments g on g.id = it.garment_id
left join garment_tags gt on gt.garment_id = g.id
left join tags cat on cat.id = gt.tag_id and cat.type = 'category'
where p.status = 'published'
group by p.id, b.id, city.slug, city.name;
