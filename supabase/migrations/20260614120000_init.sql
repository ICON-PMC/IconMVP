-- Icon — esquema inicial del MVP
-- Plataforma de descubrimiento de moda colombiana independiente (estilo Pinterest, curada).
-- Postgres / Supabase. Las imágenes viven en Cloudflare Images: aquí solo se guarda el id.
--
-- Capas:
--   MVP curado (activo): cities, brands, garments, posts (autor team/brand), tags, sizes,
--                        saved_posts, saved_garments, outbound_clicks.
--   Futuro (UGC):        posts de usuaria, post_items, post_brand_reviews, brands.owner_user_id.

-- ============================================================
-- Extensiones
-- ============================================================
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ============================================================
-- Tipos (enums)
-- ============================================================
create type price_range          as enum ('under_100k','100k_200k','200k_350k','350k_500k','over_500k');
create type tag_type             as enum ('category','occasion','style','temperature');
create type garment_status       as enum ('pending','published','archived');
create type garment_source       as enum ('team','brand','user_proposed');
create type post_author_type     as enum ('team','brand','user');
create type post_status          as enum ('draft','published','archived');
create type size_system          as enum ('alpha','numeric','special');
create type brand_review_status  as enum ('pending','accepted','declined');
create type click_source         as enum ('feed','post','garment','brand_profile');

-- ============================================================
-- Funciones utilitarias
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;
-- Nota: public.current_user_id() se define más abajo, una vez creada la tabla users
-- (las funciones `language sql` validan su cuerpo en tiempo de creación).

-- ============================================================
-- Taxonomía / vocabulario controlado
-- ============================================================
create table cities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

create table tags (
  id          uuid primary key default gen_random_uuid(),
  type        tag_type not null,
  name        text not null,
  slug        text not null,
  created_at  timestamptz not null default now(),
  unique (type, slug)
);
create index tags_type_idx on tags (type);

-- Tallas unificadas: label único para que no se dupliquen (ej. 2XS vs XXS).
-- 'numeric' se crea bajo demanda cuando la marca escribe un número.
create table sizes (
  id          uuid primary key default gen_random_uuid(),
  system      size_system not null,
  label       text not null unique,
  sort_order  integer not null default 0,
  aliases     text[] not null default '{}'
);

-- ============================================================
-- Usuarias
-- ============================================================
create table users (
  id            uuid primary key default gen_random_uuid(),
  auth_id       uuid unique references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  home_city_id  uuid references cities (id) on delete set null,
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();

-- ============================================================
-- Contenido: marcas y catálogo
-- ============================================================
create table brands (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  city_id         uuid references cities (id) on delete set null,
  store_url       text,
  instagram       text,
  price_range     price_range,
  bio             text,
  logo_url        text,
  is_active       boolean not null default true,
  is_verified     boolean not null default false,   -- verificada por el equipo
  is_sustainable  boolean not null default false,
  owner_user_id   uuid references users (id) on delete set null,  -- futuro: cuenta de marca
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index brands_city_idx on brands (city_id);
create index brands_active_idx on brands (is_active);
create trigger brands_set_updated_at before update on brands
  for each row execute function set_updated_at();

-- Garment = ítem real del catálogo de una marca. price_range se deriva solo de price_cop.
create table garments (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references brands (id) on delete cascade,
  title               text not null,
  description         text,
  price_cop           integer check (price_cop is null or price_cop >= 0),
  price_range         price_range generated always as (
                        case
                          when price_cop is null      then null
                          when price_cop < 100000     then 'under_100k'::price_range
                          when price_cop < 200000     then '100k_200k'::price_range
                          when price_cop < 350000     then '200k_350k'::price_range
                          when price_cop < 500000     then '350k_500k'::price_range
                          else                              'over_500k'::price_range
                        end
                      ) stored,
  product_url         text,
  color               text,
  fabric              text,
  status              garment_status not null default 'pending',
  source              garment_source not null default 'team',
  created_by_user_id  uuid references users (id) on delete set null,  -- prenda propuesta por usuaria
  popularity          numeric not null default 0,
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index garments_brand_idx       on garments (brand_id);
create index garments_status_idx      on garments (status);
create index garments_price_range_idx on garments (price_range);
create trigger garments_set_updated_at before update on garments
  for each row execute function set_updated_at();

create table garment_images (
  id           uuid primary key default gen_random_uuid(),
  garment_id   uuid not null references garments (id) on delete cascade,
  cf_image_id  text not null,            -- id en Cloudflare Images
  position     integer not null default 0,
  alt          text,
  created_at   timestamptz not null default now()
);
create index garment_images_garment_idx on garment_images (garment_id);

-- Categoría de la prenda (solo tags type='category', 1 por prenda por convención de curaduría).
create table garment_tags (
  garment_id  uuid not null references garments (id) on delete cascade,
  tag_id      uuid not null references tags (id) on delete cascade,
  primary key (garment_id, tag_id)
);
create index garment_tags_tag_idx on garment_tags (tag_id);

-- Tallas disponibles del ítem.
create table garment_sizes (
  garment_id  uuid not null references garments (id) on delete cascade,
  size_id     uuid not null references sizes (id) on delete restrict,
  primary key (garment_id, size_id)
);

-- ============================================================
-- Contenido: posts (fotos de outfit, unidad del feed)
-- ============================================================
create table posts (
  id               uuid primary key default gen_random_uuid(),
  author_type      post_author_type not null,
  author_brand_id  uuid references brands (id) on delete cascade,
  author_user_id   uuid references users (id) on delete cascade,
  caption          text,
  status           post_status not null default 'draft',
  popularity       numeric not null default 0,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- coherencia de autoría: usuaria -> author_user_id; team/brand -> author_brand_id
  constraint posts_author_chk check (
    (author_type = 'user'  and author_user_id is not null and author_brand_id is null)
    or (author_type in ('team','brand') and author_brand_id is not null and author_user_id is null)
  )
);
create index posts_status_idx     on posts (status);
create index posts_published_idx  on posts (published_at desc) where status = 'published';
create index posts_popularity_idx on posts (popularity desc);
create index posts_brand_idx      on posts (author_brand_id);
create trigger posts_set_updated_at before update on posts
  for each row execute function set_updated_at();

create table post_images (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references posts (id) on delete cascade,
  cf_image_id  text not null,
  position     integer not null default 0,
  width        integer,
  height       integer,
  created_at   timestamptz not null default now()
);
create index post_images_post_idx on post_images (post_id);

-- Prenda taggeada en un post. Solo aporta talla (lo que no varía); precio/color/tela van en garments.
create table post_items (
  id                 uuid primary key default gen_random_uuid(),
  post_id            uuid not null references posts (id) on delete cascade,
  garment_id         uuid not null references garments (id) on delete cascade,
  size_id            uuid references sizes (id) on delete set null,  -- talla que compró quien taggea
  position_x         real check (position_x is null or (position_x >= 0 and position_x <= 1)),
  position_y         real check (position_y is null or (position_y >= 0 and position_y <= 1)),
  is_brand_verified  boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (post_id, garment_id)
);
create index post_items_post_idx    on post_items (post_id);
create index post_items_garment_idx on post_items (garment_id);

-- Vibe del look (tags type occasion/style/temperature, varias por post).
create table post_tags (
  post_id  uuid not null references posts (id) on delete cascade,
  tag_id   uuid not null references tags (id) on delete cascade,
  primary key (post_id, tag_id)
);
create index post_tags_tag_idx on post_tags (tag_id);

-- ============================================================
-- Moderación: bandeja de verificación de marca (futuro UGC)
-- ============================================================
create table post_brand_reviews (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts (id) on delete cascade,
  brand_id    uuid not null references brands (id) on delete cascade,
  status      brand_review_status not null default 'pending',
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (post_id, brand_id)
);
create index post_brand_reviews_brand_idx on post_brand_reviews (brand_id, status);

-- ============================================================
-- Interacción de usuarias
-- ============================================================
create table user_preferences (             -- estilos elegidos en el onboarding
  user_id  uuid not null references users (id) on delete cascade,
  tag_id   uuid not null references tags (id) on delete cascade,
  primary key (user_id, tag_id)
);

create table saved_posts (                  -- guardar el post completo
  user_id     uuid not null references users (id) on delete cascade,
  post_id     uuid not null references posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index saved_posts_post_idx on saved_posts (post_id);

create table saved_garments (               -- guardar una prenda suelta
  user_id         uuid not null references users (id) on delete cascade,
  garment_id      uuid not null references garments (id) on delete cascade,
  source_post_id  uuid references posts (id) on delete set null,
  created_at      timestamptz not null default now(),
  primary key (user_id, garment_id)
);
create index saved_garments_garment_idx on saved_garments (garment_id);

-- Clics salientes a la tienda de la marca (tracking desde el día 1).
create table outbound_clicks (
  id          uuid primary key default gen_random_uuid(),
  garment_id  uuid references garments (id) on delete set null,
  brand_id    uuid references brands (id) on delete set null,
  post_id     uuid references posts (id) on delete set null,
  user_id     uuid references users (id) on delete set null,
  source      click_source not null,
  created_at  timestamptz not null default now()
);
create index outbound_clicks_brand_idx   on outbound_clicks (brand_id, created_at);
create index outbound_clicks_garment_idx on outbound_clicks (garment_id, created_at);

-- ============================================================
-- Alta de usuaria: crea public.users al registrarse en auth.users
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (auth_id, email) values (new.id, new.email);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- public.users.id del usuario autenticado actual (frontera de auth desacoplada).
create or replace function public.current_user_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.users where auth_id = auth.uid();
$$;

-- ============================================================
-- RLS — Row Level Security
-- Regla general: lectura pública del contenido publicado; cada usuaria gestiona lo suyo.
-- El equipo carga contenido con la service_role key (omite RLS).
-- ============================================================
alter table cities             enable row level security;
alter table tags               enable row level security;
alter table sizes              enable row level security;
alter table users              enable row level security;
alter table brands             enable row level security;
alter table garments           enable row level security;
alter table garment_images     enable row level security;
alter table garment_tags       enable row level security;
alter table garment_sizes      enable row level security;
alter table posts              enable row level security;
alter table post_images        enable row level security;
alter table post_items         enable row level security;
alter table post_tags          enable row level security;
alter table post_brand_reviews enable row level security;
alter table user_preferences   enable row level security;
alter table saved_posts        enable row level security;
alter table saved_garments     enable row level security;
alter table outbound_clicks    enable row level security;

-- Vocabulario: lectura pública total
create policy cities_read on cities for select to anon, authenticated using (true);
create policy tags_read   on tags   for select to anon, authenticated using (true);
create policy sizes_read  on sizes  for select to anon, authenticated using (true);

-- Marcas activas y contenido publicado: lectura pública
create policy brands_read on brands
  for select to anon, authenticated using (is_active = true);

create policy garments_read on garments
  for select to anon, authenticated using (status = 'published');

create policy posts_read on posts
  for select to anon, authenticated using (status = 'published');

-- Hijos / joins: visibles solo si su padre publicado es visible
create policy garment_images_read on garment_images
  for select to anon, authenticated
  using (exists (select 1 from garments g where g.id = garment_id and g.status = 'published'));

create policy garment_tags_read on garment_tags
  for select to anon, authenticated
  using (exists (select 1 from garments g where g.id = garment_id and g.status = 'published'));

create policy garment_sizes_read on garment_sizes
  for select to anon, authenticated
  using (exists (select 1 from garments g where g.id = garment_id and g.status = 'published'));

create policy post_images_read on post_images
  for select to anon, authenticated
  using (exists (select 1 from posts p where p.id = post_id and p.status = 'published'));

create policy post_items_read on post_items
  for select to anon, authenticated
  using (exists (select 1 from posts p where p.id = post_id and p.status = 'published'));

create policy post_tags_read on post_tags
  for select to anon, authenticated
  using (exists (select 1 from posts p where p.id = post_id and p.status = 'published'));

-- Usuaria: ve y edita su propia fila
create policy users_select_own on users
  for select to authenticated using (auth_id = auth.uid());
create policy users_update_own on users
  for update to authenticated using (auth_id = auth.uid()) with check (auth_id = auth.uid());

-- Preferencias / guardados: cada usuaria gestiona lo suyo
create policy prefs_all on user_preferences
  for all to authenticated
  using (user_id = (select public.current_user_id()))
  with check (user_id = (select public.current_user_id()));

create policy saved_posts_all on saved_posts
  for all to authenticated
  using (user_id = (select public.current_user_id()))
  with check (user_id = (select public.current_user_id()));

create policy saved_garments_all on saved_garments
  for all to authenticated
  using (user_id = (select public.current_user_id()))
  with check (user_id = (select public.current_user_id()));

-- Clics salientes: cualquiera puede registrar; no se puede atribuir a otra usuaria
create policy outbound_clicks_insert on outbound_clicks
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select public.current_user_id()));

-- ============================================================
-- Privilegios de tabla
-- RLS hace el filtrado fino por fila; estos GRANT dan el acceso base que RLS necesita.
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;

-- service_role (backend/cargadores del equipo): acceso total. BYPASSRLS salta las
-- policies pero NO los privilegios de tabla, y auto_expose_new_tables está desactivado.
grant all on all tables in schema public to service_role;

-- Escrituras puntuales (cada una respaldada por su policy de RLS)
grant insert on outbound_clicks to anon, authenticated;
grant update on users to authenticated;
grant insert, delete on user_preferences, saved_posts, saved_garments to authenticated;
