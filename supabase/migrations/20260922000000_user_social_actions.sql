-- Grupo 1 de specs/2026-09-22-user-social-actions.
-- Flujo de usuario Fase 0: seguir marcas (brand_follows) y dar like a posts (post_likes).
--
-- Decisiones de scope (ver requirements.md):
--   - Seguir solo guarda la relación; NO afecta el feed ni el orden (sin follower_count).
--   - El like es solo un contador visible; NO toca posts.popularity ni el score del feed.
--   - Guardar (saved_posts/saved_garments) ya existe y no se toca aquí.

-- ============================================================
-- brand_follows — una fila por (usuario, marca) que sigue
-- ============================================================
create table brand_follows (
  user_id     uuid not null references users (id) on delete cascade,
  brand_id    uuid not null references brands (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, brand_id)
);
create index brand_follows_brand_idx on brand_follows (brand_id);

-- ============================================================
-- post_likes — una fila por (usuario, post) con like
-- ============================================================
create table post_likes (
  user_id     uuid not null references users (id) on delete cascade,
  post_id     uuid not null references posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index post_likes_post_idx on post_likes (post_id);

-- ============================================================
-- RLS
-- Escritura: cada usuario solo gestiona sus propias filas.
-- Lectura: post_likes es de lectura pública (el contador like_count de post_feed
-- se calcula sobre TODAS las filas y es visible sin login — decisión 8a).
-- Por eso NO se usa `for all` (incluiría SELECT y restringiría el conteo al dueño):
-- se separan las policies de escritura (dueño) y de lectura (público).
-- ============================================================
alter table brand_follows enable row level security;
alter table post_likes    enable row level security;

-- brand_follows: el dueño gestiona lo suyo; lectura pública (inofensiva y consistente).
create policy brand_follows_insert on brand_follows
  for insert to authenticated
  with check (user_id = (select public.current_user_id()));
create policy brand_follows_delete on brand_follows
  for delete to authenticated
  using (user_id = (select public.current_user_id()));
create policy brand_follows_read on brand_follows
  for select to anon, authenticated using (true);

-- post_likes: el dueño gestiona lo suyo; lectura pública para el contador.
create policy post_likes_insert on post_likes
  for insert to authenticated
  with check (user_id = (select public.current_user_id()));
create policy post_likes_delete on post_likes
  for delete to authenticated
  using (user_id = (select public.current_user_id()));
create policy post_likes_read on post_likes
  for select to anon, authenticated using (true);

-- ============================================================
-- GRANT — RLS + GRANT siempre en par (constitución §7.2).
-- El select base ya lo da el grant global de init.sql; aquí las escrituras.
-- ============================================================
grant insert, delete on brand_follows to authenticated;
grant insert, delete on post_likes    to authenticated;

-- ============================================================
-- post_feed gana like_count (contador público, sin query extra en el feed).
-- El resto de la vista (incluido el cálculo de `score`) se mantiene IDÉNTICO
-- a 20260616120000_popularity_and_analytics.sql — no se toca el orden del feed.
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
  p.popularity + 5.0 / (1 + extract(epoch from (now() - coalesce(p.published_at, p.created_at))) / 86400.0) as score,
  -- like_count va AL FINAL: CREATE OR REPLACE VIEW solo puede agregar columnas
  -- al final, no insertarlas en medio (si no, Postgres cree que renombramos `score`).
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
group by p.id, b.id, city.slug, city.name;
