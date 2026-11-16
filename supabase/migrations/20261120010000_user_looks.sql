-- Spec 008, migración B: looks de usuarios.
-- Aditiva y compatible con `main`: tipos, tablas, columnas, policies y funciones nuevas. Lo único
-- recreado son protect_post_status (base: 20260919020000_protect_post_status.sql, rama de marca
-- intacta) y create_style_tag (base: 20261114000000_open_styles.sql, ahora también para usuarios,
-- FR-016). El feed no cambia hasta la migración C: los looks de usuario aún no salen en ningún feed.

-- ============================================================
-- 1. Tipos
-- ============================================================
do $$ begin
  create type brand_stub_status as enum ('open', 'claimed', 'blocked');
exception when duplicate_object then null; end $$;
do $$ begin
  create type proposed_garment_status as enum ('open', 'claimed', 'rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type report_target as enum ('post', 'profile', 'brand_review', 'proposed_garment');
exception when duplicate_object then null; end $$;
do $$ begin
  create type report_reason as enum ('not_fashion', 'offensive', 'spam', 'stolen_photo', 'other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type report_status as enum ('open', 'actioned', 'dismissed');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 2. Filtro de nombres escritos por usuarios (marcas mencionadas y prendas propuestas).
--    Mismo filtro de palabras bloqueadas que estilos y colores (FR-013), con el largo de cada caso.
-- ============================================================
create or replace function public.ugc_name_error(p_name text, p_min int, p_max int)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_name is null or char_length(btrim(p_name)) < p_min or char_length(btrim(p_name)) > p_max
      then format('El nombre debe tener entre %s y %s caracteres.', p_min, p_max)
    when btrim(p_name) !~ '^[[:alnum:]áéíóúüñÁÉÍÓÚÜÑ][[:alnum:]áéíóúüñÁÉÍÓÚÜÑ &''.\-]*$'
      then 'Usa solo letras, números, espacios y los signos & . '' -'
    when exists (
      select 1 from tag_blocklist w
      where public.f_unaccent(lower(p_name)) ~ ('(^|[^a-z0-9])' || w.word || '([^a-z0-9]|$)')
    ) then 'Ese nombre no está permitido.'
  end
$$;
revoke execute on function public.ugc_name_error(text, int, int) from public, anon;
grant execute on function public.ugc_name_error(text, int, int) to authenticated;

-- Forma normalizada de un nombre de marca (sin tildes, minúsculas, espacios simples).
create or replace function public.brand_name_key(p_name text)
returns text language sql immutable as $$
  select public.f_unaccent(lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g')))
$$;

-- ============================================================
-- 3. brand_stubs — marcas mencionadas que aún no están en Icon
-- ============================================================
create table if not exists public.brand_stubs (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(btrim(name)) between 2 and 60),
  name_key           text generated always as (public.brand_name_key(name)) stored,
  status             brand_stub_status not null default 'open',
  claimed_brand_id   uuid references public.brands (id) on delete set null,
  created_by_user_id uuid references public.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists brand_stubs_name_key_idx on public.brand_stubs (name_key);
create index if not exists brand_stubs_name_trgm_idx on public.brand_stubs using gin (name_key extensions.gin_trgm_ops);

drop trigger if exists brand_stubs_set_updated_at on public.brand_stubs;
create trigger brand_stubs_set_updated_at before update on public.brand_stubs
  for each row execute function public.set_updated_at();

alter table public.brand_stubs enable row level security;
drop policy if exists brand_stubs_read on public.brand_stubs;
create policy brand_stubs_read on public.brand_stubs for select to anon, authenticated
  using (status <> 'blocked');
drop policy if exists brand_stubs_staff_all on public.brand_stubs;
create policy brand_stubs_staff_all on public.brand_stubs for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
grant select on public.brand_stubs to anon, authenticated;
grant insert, update, delete on public.brand_stubs to authenticated;
grant all on public.brand_stubs to service_role;

-- ============================================================
-- 4. proposed_garments — prendas que no están en el catálogo
-- ============================================================
create table if not exists public.proposed_garments (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(btrim(name)) between 3 and 80),
  category_tag_id    uuid not null references public.tags (id),
  brand_id           uuid references public.brands (id) on delete set null,
  brand_stub_id      uuid references public.brand_stubs (id) on delete set null,
  status             proposed_garment_status not null default 'open',
  claimed_garment_id uuid references public.garments (id) on delete set null,
  created_by_user_id uuid not null references public.users (id) on delete cascade,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint proposed_garments_one_brand check (brand_id is null or brand_stub_id is null)
);
create index if not exists proposed_garments_creator_idx on public.proposed_garments (created_by_user_id);
create index if not exists proposed_garments_open_idx on public.proposed_garments (created_at desc) where status = 'open';

drop trigger if exists proposed_garments_set_updated_at on public.proposed_garments;
create trigger proposed_garments_set_updated_at before update on public.proposed_garments
  for each row execute function public.set_updated_at();

create table if not exists public.proposed_garment_colors (
  proposed_garment_id uuid not null references public.proposed_garments (id) on delete cascade,
  color_id            uuid not null references public.colors (id) on delete cascade,
  primary key (proposed_garment_id, color_id)
);

-- ============================================================
-- 5. post_proposed_items y post_brand_mentions
-- ============================================================
create table if not exists public.post_proposed_items (
  id                  uuid primary key default gen_random_uuid(),
  post_id             uuid not null references public.posts (id) on delete cascade,
  proposed_garment_id uuid not null references public.proposed_garments (id) on delete cascade,
  position            integer not null default 0,
  position_x          real check (position_x is null or (position_x >= 0 and position_x <= 1)),
  position_y          real check (position_y is null or (position_y >= 0 and position_y <= 1)),
  created_at          timestamptz not null default now(),
  unique (post_id, proposed_garment_id)
);
create index if not exists post_proposed_items_garment_idx on public.post_proposed_items (proposed_garment_id);

create table if not exists public.post_brand_mentions (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts (id) on delete cascade,
  brand_id      uuid references public.brands (id) on delete cascade,
  brand_stub_id uuid references public.brand_stubs (id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint post_brand_mentions_one_target check ((brand_id is null) <> (brand_stub_id is null)),
  unique (post_id, brand_id),
  unique (post_id, brand_stub_id)
);
create index if not exists post_brand_mentions_post_idx on public.post_brand_mentions (post_id);
create index if not exists post_brand_mentions_stub_idx on public.post_brand_mentions (brand_stub_id) where brand_stub_id is not null;
create index if not exists post_brand_mentions_brand_idx on public.post_brand_mentions (brand_id) where brand_id is not null;

-- ============================================================
-- 6. content_reports — reportes (sirve también a las specs 009 y 011)
-- ============================================================
create table if not exists public.content_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.users (id) on delete cascade,
  target_type      report_target not null,
  target_id        uuid not null,
  reason           report_reason not null,
  note             text check (note is null or char_length(note) <= 500),
  status           report_status not null default 'open',
  resolved_by      uuid references public.users (id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (reporter_user_id, target_type, target_id)
);
create index if not exists content_reports_open_idx on public.content_reports (target_type, target_id) where status = 'open';

alter table public.content_reports enable row level security;
drop policy if exists content_reports_read_own on public.content_reports;
create policy content_reports_read_own on public.content_reports for select to authenticated
  using (reporter_user_id = (select public.current_user_id()));
drop policy if exists content_reports_staff_all on public.content_reports;
create policy content_reports_staff_all on public.content_reports for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
grant select, update, delete on public.content_reports to authenticated;
grant all on public.content_reports to service_role;

-- ============================================================
-- 7. posts: columnas de moderación, largo del texto y policies de usuario
-- ============================================================
alter table public.posts add column if not exists moderation_locked boolean not null default false;
alter table public.posts add column if not exists hidden_at timestamptz;
alter table public.posts add column if not exists hidden_reason text;
alter table public.posts add column if not exists reviewed_at timestamptz;
create index if not exists posts_user_idx on public.posts (author_user_id, published_at desc) where author_user_id is not null;

alter table public.posts drop constraint if exists posts_user_caption_len;
alter table public.posts add constraint posts_user_caption_len
  check (author_type <> 'user' or caption is null or char_length(caption) <= 500) not valid;
alter table public.posts validate constraint posts_user_caption_len;

drop policy if exists posts_user_insert on public.posts;
create policy posts_user_insert on public.posts for insert to authenticated
  with check (author_type = 'user' and author_user_id = (select public.current_user_id()));
drop policy if exists posts_user_read_own on public.posts;
create policy posts_user_read_own on public.posts for select to authenticated
  using (author_user_id = (select public.current_user_id()));
drop policy if exists posts_user_update on public.posts;
create policy posts_user_update on public.posts for update to authenticated
  using (author_user_id = (select public.current_user_id()))
  with check (author_type = 'user' and author_user_id = (select public.current_user_id()));
drop policy if exists posts_user_delete on public.posts;
create policy posts_user_delete on public.posts for delete to authenticated
  using (author_user_id = (select public.current_user_id()));
grant insert, update, delete on public.posts to authenticated;

-- ¿El post es un look propio editable? (de quien consulta y no retirado por el equipo)
create or replace function public.is_my_editable_look(p_post_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts p
    where p.id = p_post_id and p.author_type = 'user'
      and p.author_user_id = public.current_user_id()
      and not p.moderation_locked
  );
$$;
revoke execute on function public.is_my_editable_look(uuid) from public, anon;
grant execute on function public.is_my_editable_look(uuid) to authenticated;

drop policy if exists post_images_user_all on public.post_images;
create policy post_images_user_all on public.post_images for all to authenticated
  using (exists (select 1 from posts p where p.id = post_images.post_id
                 and p.author_user_id = (select public.current_user_id())))
  with check (public.is_my_editable_look(post_id));

drop policy if exists post_tags_user_all on public.post_tags;
create policy post_tags_user_all on public.post_tags for all to authenticated
  using (exists (select 1 from posts p where p.id = post_tags.post_id
                 and p.author_user_id = (select public.current_user_id())))
  with check (
    public.is_my_editable_look(post_id)
    and exists (select 1 from tags t where t.id = post_tags.tag_id
                and t.type in ('style', 'occasion') and not t.is_hidden)
  );

drop policy if exists post_items_user_all on public.post_items;
create policy post_items_user_all on public.post_items for all to authenticated
  using (exists (select 1 from posts p where p.id = post_items.post_id
                 and p.author_user_id = (select public.current_user_id())))
  with check (
    public.is_my_editable_look(post_id)
    and exists (select 1 from garments g where g.id = post_items.garment_id and g.status = 'published')
  );
grant insert, update, delete on public.post_images, public.post_tags, public.post_items to authenticated;

-- ============================================================
-- 8. RLS de las tablas nuevas de looks
-- ============================================================
alter table public.post_proposed_items enable row level security;
drop policy if exists post_proposed_items_read on public.post_proposed_items;
create policy post_proposed_items_read on public.post_proposed_items for select to anon, authenticated
  using (exists (select 1 from posts p where p.id = post_proposed_items.post_id and p.status = 'published'));
drop policy if exists post_proposed_items_own on public.post_proposed_items;
create policy post_proposed_items_own on public.post_proposed_items for all to authenticated
  using (exists (select 1 from posts p where p.id = post_proposed_items.post_id
                 and p.author_user_id = (select public.current_user_id())))
  with check (public.is_my_editable_look(post_id));
drop policy if exists post_proposed_items_staff_all on public.post_proposed_items;
create policy post_proposed_items_staff_all on public.post_proposed_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
grant select on public.post_proposed_items to anon, authenticated;
grant insert, update, delete on public.post_proposed_items to authenticated;
grant all on public.post_proposed_items to service_role;

alter table public.post_brand_mentions enable row level security;
drop policy if exists post_brand_mentions_read on public.post_brand_mentions;
create policy post_brand_mentions_read on public.post_brand_mentions for select to anon, authenticated
  using (exists (select 1 from posts p where p.id = post_brand_mentions.post_id and p.status = 'published'));
drop policy if exists post_brand_mentions_own on public.post_brand_mentions;
create policy post_brand_mentions_own on public.post_brand_mentions for all to authenticated
  using (exists (select 1 from posts p where p.id = post_brand_mentions.post_id
                 and p.author_user_id = (select public.current_user_id())))
  with check (public.is_my_editable_look(post_id));
drop policy if exists post_brand_mentions_staff_all on public.post_brand_mentions;
create policy post_brand_mentions_staff_all on public.post_brand_mentions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
grant select on public.post_brand_mentions to anon, authenticated;
grant insert, update, delete on public.post_brand_mentions to authenticated;
grant all on public.post_brand_mentions to service_role;

alter table public.proposed_garments enable row level security;
drop policy if exists proposed_garments_read on public.proposed_garments;
create policy proposed_garments_read on public.proposed_garments for select to anon, authenticated
  using (
    (status <> 'rejected' and exists (
      select 1 from post_proposed_items ppi join posts p on p.id = ppi.post_id
      where ppi.proposed_garment_id = proposed_garments.id and p.status = 'published'))
    or created_by_user_id = (select public.current_user_id())
  );
drop policy if exists proposed_garments_insert on public.proposed_garments;
create policy proposed_garments_insert on public.proposed_garments for insert to authenticated
  with check (created_by_user_id = (select public.current_user_id()) and status = 'open');
drop policy if exists proposed_garments_own_update on public.proposed_garments;
create policy proposed_garments_own_update on public.proposed_garments for update to authenticated
  using (created_by_user_id = (select public.current_user_id()) and status = 'open')
  with check (created_by_user_id = (select public.current_user_id()) and status = 'open');
drop policy if exists proposed_garments_own_delete on public.proposed_garments;
create policy proposed_garments_own_delete on public.proposed_garments for delete to authenticated
  using (created_by_user_id = (select public.current_user_id()) and status = 'open');
drop policy if exists proposed_garments_staff_all on public.proposed_garments;
create policy proposed_garments_staff_all on public.proposed_garments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
grant select on public.proposed_garments to anon, authenticated;
grant insert, update, delete on public.proposed_garments to authenticated;
grant all on public.proposed_garments to service_role;

alter table public.proposed_garment_colors enable row level security;
drop policy if exists proposed_garment_colors_read on public.proposed_garment_colors;
create policy proposed_garment_colors_read on public.proposed_garment_colors for select to anon, authenticated
  using (exists (select 1 from proposed_garments pg where pg.id = proposed_garment_colors.proposed_garment_id));
drop policy if exists proposed_garment_colors_own on public.proposed_garment_colors;
create policy proposed_garment_colors_own on public.proposed_garment_colors for all to authenticated
  using (exists (select 1 from proposed_garments pg where pg.id = proposed_garment_colors.proposed_garment_id
                 and pg.created_by_user_id = (select public.current_user_id()) and pg.status = 'open'))
  with check (exists (select 1 from proposed_garments pg where pg.id = proposed_garment_colors.proposed_garment_id
                 and pg.created_by_user_id = (select public.current_user_id()) and pg.status = 'open'));
drop policy if exists proposed_garment_colors_staff_all on public.proposed_garment_colors;
create policy proposed_garment_colors_staff_all on public.proposed_garment_colors for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
grant select on public.proposed_garment_colors to anon, authenticated;
grant insert, delete on public.proposed_garment_colors to authenticated;
grant all on public.proposed_garment_colors to service_role;

-- ============================================================
-- 9. protect_post_status: rama de marca intacta + reglas de looks de usuario (R6).
--    icon.moderation = 'on' lo marcan report_content / moderate_post para tocar los campos de
--    moderación sin ser staff (el ocultamiento automático corre con la sesión de quien reporta).
-- ============================================================
create or replace function public.protect_post_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_insert boolean := tg_op = 'INSERT';
  was_published boolean := (not is_insert) and old.status = 'published';
  moderating boolean := coalesce(current_setting('icon.moderation', true), '') = 'on';
  author users;
begin
  -- Rama de marca (sin cambios): solo una marca aprobada puede publicar.
  if auth.uid() is not null and not public.is_staff()
     and new.status = 'published' and new.author_brand_id is not null
     and not exists (select 1 from public.brands b where b.id = new.author_brand_id and b.status = 'active') then
    new.status := 'draft';
    new.published_at := null;
  end if;

  -- Rama de usuario: quien escribe es una persona (no staff, no SQL directo ni service_role).
  if (new.author_type = 'user' or (not is_insert and old.author_type = 'user'))
     and auth.uid() is not null and not public.is_staff() and not moderating then

    if is_insert then
      new.moderation_locked := false;
      new.hidden_at := null;
      new.hidden_reason := null;
      new.reviewed_at := null;
      new.popularity := 0;
    else
      if old.moderation_locked then
        raise exception 'El equipo de Icon retiró este look y no se puede volver a publicar.'
          using errcode = 'check_violation';
      end if;
      new.moderation_locked := old.moderation_locked;
      new.hidden_at := old.hidden_at;
      new.hidden_reason := old.hidden_reason;
      new.reviewed_at := old.reviewed_at;
      new.author_type := old.author_type;
      new.author_user_id := old.author_user_id;
      new.author_brand_id := old.author_brand_id;
      new.popularity := old.popularity;
      -- Ocultado por reportes: queda en manos del equipo.
      if old.hidden_at is not null and new.status is distinct from old.status then
        raise exception 'Este look está en revisión del equipo de Icon.' using errcode = 'check_violation';
      end if;
    end if;

    if new.status = 'archived' and (is_insert or old.status <> 'archived') then
      raise exception 'Para ocultar tu look, despublícalo.' using errcode = 'check_violation';
    end if;

    if new.status = 'published' and not was_published then
      select * into author from users where id = new.author_user_id;
      if author.posting_blocked_at is not null then
        raise exception 'Tu cuenta no puede publicar por ahora. Escríbenos si crees que es un error.'
          using errcode = 'check_violation';
      end if;
      if author.role = 'brand' then
        raise exception 'Las marcas publican sus looks desde el panel de marca.' using errcode = 'check_violation';
      end if;
      if (select count(*) from posts p
          where p.author_user_id = new.author_user_id and p.author_type = 'user' and p.id <> new.id
            and p.published_at > now() - interval '24 hours') >= 5 then
        raise exception 'Llegaste al límite de 5 looks por día. Vuelve a intentarlo mañana.'
          using errcode = 'check_violation';
      end if;
      if not exists (select 1 from post_images where post_id = new.id) then
        raise exception 'Agrega al menos una foto.' using errcode = 'check_violation';
      end if;
      if not exists (select 1 from post_items where post_id = new.id)
         and not exists (select 1 from post_proposed_items where post_id = new.id)
         and not exists (select 1 from post_brand_mentions where post_id = new.id) then
        raise exception 'Etiqueta al menos una prenda o una marca.' using errcode = 'check_violation';
      end if;
      if not exists (select 1 from post_tags pt join tags t on t.id = pt.tag_id
                     where pt.post_id = new.id and t.type = 'style') then
        raise exception 'Elige al menos un estilo.' using errcode = 'check_violation';
      end if;
      if not exists (select 1 from post_tags pt join tags t on t.id = pt.tag_id
                     where pt.post_id = new.id and t.type = 'occasion') then
        raise exception 'Elige al menos una ocasión.' using errcode = 'check_violation';
      end if;
      new.published_at := now();
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists posts_protect_status on posts;
create trigger posts_protect_status
  before insert or update on posts
  for each row execute function public.protect_post_status();

-- ============================================================
-- 10. Límites por look de usuario: 4 fotos, 6 estilos, 3 ocasiones, 10 etiquetas.
-- ============================================================
create or replace function public.check_user_post_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_user_post boolean;
  t tag_type;
  n int;
begin
  select p.author_type = 'user' into is_user_post from posts p where p.id = new.post_id;
  if not coalesce(is_user_post, false) then
    return new;
  end if;

  if tg_table_name = 'post_images' then
    if (select count(*) from post_images where post_id = new.post_id) >= 4 then
      raise exception 'Un look puede tener hasta 4 fotos.' using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'post_tags' then
    select type into t from tags where id = new.tag_id;
    select count(*) into n from post_tags pt join tags x on x.id = pt.tag_id
      where pt.post_id = new.post_id and x.type = t;
    if t = 'style' and n >= 6 then
      raise exception 'Elige hasta 6 estilos.' using errcode = 'check_violation';
    elsif t = 'occasion' and n >= 3 then
      raise exception 'Elige hasta 3 ocasiones.' using errcode = 'check_violation';
    end if;
  else
    if (select count(*) from post_items where post_id = new.post_id)
     + (select count(*) from post_proposed_items where post_id = new.post_id)
     + (select count(*) from post_brand_mentions where post_id = new.post_id) >= 10 then
      raise exception 'Un look puede tener hasta 10 prendas o marcas etiquetadas.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists post_images_user_limits on post_images;
create trigger post_images_user_limits before insert on post_images
  for each row execute function public.check_user_post_limits();
drop trigger if exists post_tags_user_limits on post_tags;
create trigger post_tags_user_limits before insert on post_tags
  for each row execute function public.check_user_post_limits();
drop trigger if exists post_items_user_limits on post_items;
create trigger post_items_user_limits before insert on post_items
  for each row execute function public.check_user_post_limits();
drop trigger if exists post_proposed_items_user_limits on post_proposed_items;
create trigger post_proposed_items_user_limits before insert on post_proposed_items
  for each row execute function public.check_user_post_limits();
drop trigger if exists post_brand_mentions_user_limits on post_brand_mentions;
create trigger post_brand_mentions_user_limits before insert on post_brand_mentions
  for each row execute function public.check_user_post_limits();

-- ============================================================
-- 11. is_brand_verified: solo la marca de la prenda (o el equipo) la marca.
-- ============================================================
create or replace function public.protect_post_item_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;
  if exists (select 1 from garments g where g.id = new.garment_id and public.is_brand_owner(g.brand_id)) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_brand_verified := false;
  else
    new.is_brand_verified := old.is_brand_verified;
  end if;
  return new;
end; $$;

drop trigger if exists post_items_protect_verified on post_items;
create trigger post_items_protect_verified before insert or update on post_items
  for each row execute function public.protect_post_item_verified();

-- ============================================================
-- 12. Prendas propuestas: nombre, categoría, máx. 3 colores y borrado si quedan sin looks.
-- ============================================================
create or replace function public.validate_proposed_garment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  err text;
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    err := public.ugc_name_error(new.name, 3, 80);
    if err is not null then
      raise exception '%', err using errcode = 'check_violation';
    end if;
    new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  end if;
  if not exists (select 1 from tags where id = new.category_tag_id and type = 'category') then
    raise exception 'Elige una categoría válida.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

drop trigger if exists proposed_garments_validate on proposed_garments;
create trigger proposed_garments_validate before insert or update of name, category_tag_id on proposed_garments
  for each row execute function public.validate_proposed_garment();

create or replace function public.check_proposed_garment_colors()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from proposed_garment_colors where proposed_garment_id = new.proposed_garment_id) >= 3 then
    raise exception 'Elige hasta 3 colores.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

drop trigger if exists proposed_garment_colors_max on proposed_garment_colors;
create trigger proposed_garment_colors_max before insert on proposed_garment_colors
  for each row execute function public.check_proposed_garment_colors();

create or replace function public.delete_orphan_proposed_garment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from proposed_garments pg
  where pg.id = old.proposed_garment_id and pg.status = 'open'
    and not exists (select 1 from post_proposed_items x where x.proposed_garment_id = pg.id);
  return null;
end; $$;

drop trigger if exists post_proposed_items_cleanup on post_proposed_items;
create trigger post_proposed_items_cleanup after delete on post_proposed_items
  for each row execute function public.delete_orphan_proposed_garment();

-- ============================================================
-- 13. Cuota de 50 MB por usuario (R8)
-- ============================================================
create or replace function public.user_storage_bytes(p_user_id uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(pi.bytes) from post_images pi
              join posts p on p.id = pi.post_id
              where p.author_user_id = p_user_id), 0)
  + coalesce((select u.avatar_bytes from users u where u.id = p_user_id), 0);
$$;

create or replace function public.check_user_storage_quota(p_bytes bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_limit constant bigint := 52428800;  -- 50 MB
  me uuid := public.current_user_id();
  v_used bigint;
begin
  if me is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_used := public.user_storage_bytes(me);
  return jsonb_build_object(
    'allowed', v_used + greatest(p_bytes, 0) <= v_limit,
    'used_bytes', v_used,
    'limit_bytes', v_limit
  );
end; $$;

revoke all on function public.user_storage_bytes(uuid) from public, anon, authenticated;
grant execute on function public.user_storage_bytes(uuid) to service_role;
revoke all on function public.check_user_storage_quota(bigint) from public, anon;
grant execute on function public.check_user_storage_quota(bigint) to authenticated, service_role;

-- ============================================================
-- 14. Marcas mencionadas: obtener o crear, y buscar
-- ============================================================
create or replace function public.get_or_create_brand_stub(p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
  k text := public.brand_name_key(p_name);
  clean text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  err text;
  b brands;
  s brand_stubs;
begin
  if me is null then
    raise exception 'Inicia sesión para mencionar marcas.' using errcode = 'insufficient_privilege';
  end if;
  err := public.ugc_name_error(clean, 2, 60);
  if err is not null then
    raise exception '%', err using errcode = 'check_violation';
  end if;

  select * into b from brands
  where is_active and public.brand_name_key(name) = k
  order by created_at limit 1;
  if found then
    return jsonb_build_object('kind', 'brand', 'id', b.id, 'name', b.name, 'slug', b.slug);
  end if;

  select * into s from brand_stubs where name_key = k;
  if found then
    if s.status = 'blocked' then
      raise exception 'Esa marca no hace parte de Icon.' using errcode = 'check_violation';
    end if;
    if s.status = 'claimed' and s.claimed_brand_id is not null then
      select * into b from brands where id = s.claimed_brand_id and is_active;
      if found then
        return jsonb_build_object('kind', 'brand', 'id', b.id, 'name', b.name, 'slug', b.slug);
      end if;
    end if;
    return jsonb_build_object('kind', 'stub', 'id', s.id, 'name', s.name, 'slug', null);
  end if;

  if (select count(*) from brand_stubs
      where created_by_user_id = me and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Llegaste al límite de marcas nuevas por hoy. Vuelve a intentarlo mañana.'
      using errcode = 'check_violation';
  end if;

  insert into brand_stubs (name, created_by_user_id) values (clean, me) returning * into s;
  return jsonb_build_object('kind', 'stub', 'id', s.id, 'name', s.name, 'slug', null);
end; $$;
revoke execute on function public.get_or_create_brand_stub(text) from public, anon;
grant execute on function public.get_or_create_brand_stub(text) to authenticated;

create or replace function public.search_brand_mentions(q text)
returns table (kind text, id uuid, name text, slug text)
language sql stable security definer set search_path = public as $$
  with k as (select public.brand_name_key(q) as key)
  select r.kind, r.id, r.name, r.slug from (
    select 'brand'::text as kind, b.id, b.name, b.slug,
           0 as rank_group, extensions.similarity(public.brand_name_key(b.name), k.key) as sim
    from brands b, k
    where b.is_active and char_length(k.key) >= 1
      and (public.brand_name_key(b.name) like '%' || k.key || '%'
           or extensions.similarity(public.brand_name_key(b.name), k.key) > 0.3)
    union all
    select 'stub', s.id, s.name, null, 1, extensions.similarity(s.name_key, k.key)
    from brand_stubs s, k
    where s.status = 'open' and char_length(k.key) >= 1
      and (s.name_key like '%' || k.key || '%' or extensions.similarity(s.name_key, k.key) > 0.3)
  ) r
  order by r.rank_group, r.sim desc, r.name
  limit 12;
$$;
revoke execute on function public.search_brand_mentions(text) from public, anon;
grant execute on function public.search_brand_mentions(text) to authenticated;

-- ============================================================
-- 15. Reportes y moderación (R7)
-- ============================================================
create or replace function public.report_content(
  p_target_type report_target, p_target_id uuid, p_reason report_reason, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
  p posts;
  inserted int;
begin
  if me is null then
    raise exception 'Inicia sesión para reportar.' using errcode = 'insufficient_privilege';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'La nota puede tener hasta 500 caracteres.' using errcode = 'check_violation';
  end if;

  if p_target_type = 'post' then
    select * into p from posts where id = p_target_id;
    if not found or p.status <> 'published' then
      raise exception 'Ese look ya no está disponible.' using errcode = 'check_violation';
    end if;
    if p.author_user_id = me then
      raise exception 'No puedes reportar tu propio look.' using errcode = 'check_violation';
    end if;
  elsif p_target_type = 'profile' and p_target_id = me then
    raise exception 'No puedes reportar tu propio perfil.' using errcode = 'check_violation';
  elsif p_target_type = 'proposed_garment'
        and exists (select 1 from proposed_garments where id = p_target_id and created_by_user_id = me) then
    raise exception 'No puedes reportar tu propia prenda.' using errcode = 'check_violation';
  end if;

  insert into content_reports (reporter_user_id, target_type, target_id, reason, note)
  values (me, p_target_type, p_target_id, p_reason, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (reporter_user_id, target_type, target_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('already', true);
  end if;

  -- Ocultamiento automático: 3 reportes abiertos de cuentas distintas sobre un look de usuario
  -- que el equipo no haya revisado.
  if p_target_type = 'post' and p.author_type = 'user' and p.reviewed_at is null
     and (select count(distinct reporter_user_id) from content_reports
          where target_type = 'post' and target_id = p_target_id and status = 'open') >= 3 then
    perform set_config('icon.moderation', 'on', true);
    update posts set status = 'archived', hidden_at = now(), hidden_reason = 'auto'
    where id = p_target_id;
    perform set_config('icon.moderation', '', true);
  end if;
  return jsonb_build_object('already', false);
end; $$;
revoke execute on function public.report_content(report_target, uuid, report_reason, text) from public, anon;
grant execute on function public.report_content(report_target, uuid, report_reason, text) to authenticated;

create or replace function public.moderate_post(p_post_id uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo puede moderar.' using errcode = 'insufficient_privilege';
  end if;
  if p_action = 'hide' then
    update posts set status = 'archived', moderation_locked = true, hidden_at = now(),
                     hidden_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Retirado por el equipo')
    where id = p_post_id;
    update content_reports set status = 'actioned', resolved_by = me, resolved_at = now()
    where target_type = 'post' and target_id = p_post_id and status = 'open';
  elsif p_action = 'restore' then
    update posts set status = 'published', moderation_locked = false, hidden_at = null,
                     hidden_reason = null, reviewed_at = now(),
                     published_at = coalesce(published_at, now())
    where id = p_post_id;
    update content_reports set status = 'dismissed', resolved_by = me, resolved_at = now()
    where target_type = 'post' and target_id = p_post_id and status = 'open';
  elsif p_action = 'dismiss' then
    update posts set reviewed_at = now() where id = p_post_id;
    update content_reports set status = 'dismissed', resolved_by = me, resolved_at = now()
    where target_type = 'post' and target_id = p_post_id and status = 'open';
  else
    raise exception 'Acción no válida.' using errcode = 'check_violation';
  end if;
end; $$;
revoke execute on function public.moderate_post(uuid, text, text) from public, anon;
grant execute on function public.moderate_post(uuid, text, text) to authenticated;

create or replace function public.set_user_posting_block(p_user_id uuid, p_blocked boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo puede bloquear cuentas.' using errcode = 'insufficient_privilege';
  end if;
  perform set_config('icon.moderation', 'on', true);
  update users set
    posting_blocked_at = case when p_blocked then now() end,
    posting_blocked_reason = case when p_blocked then nullif(btrim(coalesce(p_reason, '')), '') end
  where id = p_user_id;
  perform set_config('icon.moderation', '', true);
end; $$;
revoke execute on function public.set_user_posting_block(uuid, boolean, text) from public, anon;
grant execute on function public.set_user_posting_block(uuid, boolean, text) to authenticated;

create or replace function public.set_brand_stub_blocked(p_stub_id uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo puede bloquear marcas.' using errcode = 'insufficient_privilege';
  end if;
  update brand_stubs set status = case when p_blocked then 'blocked'::brand_stub_status else 'open'::brand_stub_status end
  where id = p_stub_id and status <> 'claimed';
end; $$;
revoke execute on function public.set_brand_stub_blocked(uuid, boolean) from public, anon;
grant execute on function public.set_brand_stub_blocked(uuid, boolean) to authenticated;

-- Cuentas con publicación bloqueada (pestaña "Comunidad" del panel). `users` solo deja leer la
-- fila propia, por eso security definer y solo staff.
create or replace function public.admin_blocked_users()
returns table (id uuid, email text, display_name text, handle text, posting_blocked_at timestamptz, posting_blocked_reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo puede ver esta lista.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select u.id, u.email, u.display_name, u.handle, u.posting_blocked_at, u.posting_blocked_reason
    from users u where u.posting_blocked_at is not null
    order by u.posting_blocked_at desc;
end; $$;
revoke execute on function public.admin_blocked_users() from public, anon;
grant execute on function public.admin_blocked_users() to authenticated;

-- ============================================================
-- 16. Limpieza (R13) y métricas (US6)
-- ============================================================
create or replace function public.stale_user_drafts(p_days int)
returns table (post_id uuid, image_key text)
language sql stable security definer set search_path = public as $$
  select p.id, pi.cf_image_id
  from posts p
  left join post_images pi on pi.post_id = p.id
  where p.author_type = 'user' and p.status = 'draft'
    and p.updated_at < now() - make_interval(days => greatest(p_days, 1));
$$;
revoke execute on function public.stale_user_drafts(int) from public, anon, authenticated;
grant execute on function public.stale_user_drafts(int) to service_role;

create or replace function public.user_look_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo puede ver estas métricas.' using errcode = 'insufficient_privilege';
  end if;
  with looks as (
    select p.id, p.author_user_id, p.published_at
    from posts p where p.author_type = 'user' and p.status = 'published'
  ),
  branded as (
    select distinct l.id from looks l
    where exists (select 1 from post_items it where it.post_id = l.id)
       or exists (select 1 from post_brand_mentions m where m.post_id = l.id and m.brand_id is not null)
       or exists (select 1 from post_proposed_items x join proposed_garments pg on pg.id = x.proposed_garment_id
                  where x.post_id = l.id and pg.brand_id is not null)
  ),
  clicks as (
    select oc.brand_id, count(*) as n
    from outbound_clicks oc join looks l on l.id = oc.post_id
    group by oc.brand_id
  )
  select jsonb_build_object(
    'published', (select count(*) from looks),
    'published_30d', (select count(*) from looks where published_at > now() - interval '30 days'),
    'authors', (select count(distinct author_user_id) from looks),
    'with_brand', (select count(*) from branded),
    'brands_tagged', (
      select count(distinct b) from (
        select g.brand_id as b from looks l join post_items it on it.post_id = l.id join garments g on g.id = it.garment_id
        union
        select m.brand_id from looks l join post_brand_mentions m on m.post_id = l.id where m.brand_id is not null
      ) t),
    'clicks', coalesce((select sum(n) from clicks), 0),
    'clicks_by_brand', coalesce((
      select jsonb_agg(jsonb_build_object('brand_id', c.brand_id, 'name', b.name, 'clicks', c.n) order by c.n desc)
      from clicks c left join brands b on b.id = c.brand_id), '[]'::jsonb)
  ) into result;
  return result;
end; $$;
revoke execute on function public.user_look_stats() from public, anon;
grant execute on function public.user_look_stats() to authenticated;

-- ============================================================
-- 17. create_style_tag: también usuarios (FR-016, mismas reglas de la spec 004).
--     Cambio respecto a 20261114000000: además de marcas y equipo, cualquier cuenta sin bloqueo de
--     publicación, con un máximo de 5 estilos nuevos por día por persona.
-- ============================================================
create or replace function public.create_style_tag(p_name text)
returns setof tags
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
  my_brand uuid := (select b.id from brands b where b.owner_user_id = me order by b.created_at limit 1);
  blocked boolean := (select posting_blocked_at is not null from users where id = me);
  k text := regexp_replace(public.f_unaccent(lower(coalesce(p_name, ''))), '[^a-z0-9]', '', 'g');
  existing tags;
  err text;
begin
  if me is null or (not public.is_staff() and coalesce(blocked, false)) then
    raise exception 'Tu cuenta no puede crear estilos por ahora.' using errcode = 'insufficient_privilege';
  end if;
  select * into existing from tags where type = 'style' and name_key = k;
  if found then
    if existing.is_hidden then
      raise exception 'Ese estilo no está disponible.' using errcode = 'check_violation';
    end if;
    return next existing;
    return;
  end if;
  err := public.vocab_name_error(p_name);
  if err is not null then
    raise exception '%', err using errcode = 'check_violation';
  end if;
  if not public.is_staff() and my_brand is null
     and (select count(*) from tags where created_by_user_id = me and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Llegaste al límite de estilos nuevos por hoy.' using errcode = 'check_violation';
  end if;
  return query
    insert into tags (type, name, slug, created_by_brand_id, created_by_user_id)
    values (
      'style',
      btrim(regexp_replace(p_name, '\s+', ' ', 'g')),
      public.vocab_slug(p_name, array(select slug from tags where type = 'style')),
      case when public.is_staff() then null else my_brand end,
      me
    )
    returning *;
end; $$;

revoke execute on function public.create_style_tag(text) from public, anon;
grant execute on function public.create_style_tag(text) to authenticated;
