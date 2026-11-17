-- Spec 009: perfil público, seguir personas y vista "Siguiendo".
-- Aditiva. Requiere las migraciones A, B y C de la spec 008 (feed_items con columnas de autor).
-- Funciones recreadas conservando toda su lógica anterior:
--   handle_new_user         ← base: 20261120000000_user_identity.sql
--   protect_user_role_field ← base: 20261120000000_user_identity.sql
--   public_profiles (vista) ← base: 20261120000000_user_identity.sql (mismas columnas y orden; is_hidden al final)
-- Toda función nueva lleva su revoke/grant explícito (20261121000000_harden_table_privileges.sql).

-- ============================================================
-- 1. users: aviso de perfil público y ocultamiento por el equipo
-- ============================================================
alter table public.users add column if not exists profile_notice_seen_at timestamptz;
alter table public.users add column if not exists profile_hidden_at timestamptz;
alter table public.users add column if not exists profile_hidden_reason text;

alter table public.users drop constraint if exists users_display_name_len;
alter table public.users add constraint users_display_name_len
  check (display_name is null or char_length(display_name) <= 40) not valid;
alter table public.users validate constraint users_display_name_len;

-- Las cuentas nuevas no ven el aviso (nacen sabiendo que el perfil es público).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (auth_id, email, display_name, handle, profile_notice_seen_at)
  values (
    new.id,
    new.email,
    nullif(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ), ''),
    public.generate_handle(),
    now()
  );
  return new;
end; $$;

-- Conserva rol, brand_id, moderación y handle (spec 008) y protege el ocultamiento de perfil.
create or replace function public.protect_user_role_field()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and coalesce(current_setting('icon.role_change', true), '') <> 'on'
     and not (old.role = 'user' and new.role = 'brand') then
    new.role := old.role;
  end if;
  if not public.is_staff() and pg_trigger_depth() = 1 and auth.uid() is not null then
    new.brand_id := old.brand_id;
  end if;
  if auth.uid() is not null and not public.is_staff()
     and coalesce(current_setting('icon.moderation', true), '') <> 'on' then
    new.posting_blocked_at := old.posting_blocked_at;
    new.posting_blocked_reason := old.posting_blocked_reason;
    new.profile_hidden_at := old.profile_hidden_at;
    new.profile_hidden_reason := old.profile_hidden_reason;
  end if;
  -- Handle: solo cambia desde set_my_handle(), que marca icon.handle_change.
  if new.handle is distinct from old.handle
     and auth.uid() is not null
     and coalesce(current_setting('icon.handle_change', true), '') <> 'on' then
    new.handle := old.handle;
    new.handle_changed_at := old.handle_changed_at;
  end if;
  return new;
end; $$;

-- ============================================================
-- 2. Nombres reservados
-- ============================================================
create table if not exists public.reserved_handles (
  handle text primary key check (handle = lower(handle))
);
insert into public.reserved_handles (handle) values
  ('admin'), ('administrador'), ('api'), ('auth'), ('buscar'), ('ayuda'), ('configuracion'), ('crear'),
  ('editar'), ('equipo'), ('explorar'), ('feed'), ('guardados'), ('icon'), ('iconcolombia'), ('login'),
  ('logout'), ('marca'), ('marcas'), ('mi'), ('nosotros'), ('onboarding'), ('out'), ('panel'), ('perfil'),
  ('post'), ('prenda'), ('privacidad'), ('saved'), ('settings'), ('signup'), ('soporte'), ('staff'),
  ('terminos'), ('u'), ('usuario'), ('www'), ('siguiendo')
on conflict do nothing;

alter table public.reserved_handles enable row level security;
drop policy if exists reserved_handles_read on public.reserved_handles;
create policy reserved_handles_read on public.reserved_handles for select to anon, authenticated using (true);
drop policy if exists reserved_handles_staff_all on public.reserved_handles;
create policy reserved_handles_staff_all on public.reserved_handles for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
grant select on public.reserved_handles to anon, authenticated;
grant insert, update, delete on public.reserved_handles to authenticated;
grant all on public.reserved_handles to service_role;

-- ============================================================
-- 3. user_follows
-- ============================================================
create table if not exists public.user_follows (
  follower_id uuid not null references public.users (id) on delete cascade,
  followed_id uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint user_follows_not_self check (follower_id <> followed_id)
);
create index if not exists user_follows_followed_idx on public.user_follows (followed_id);

alter table public.user_follows enable row level security;
drop policy if exists user_follows_insert on public.user_follows;
create policy user_follows_insert on public.user_follows for insert to authenticated
  with check (follower_id = (select public.current_user_id()));
drop policy if exists user_follows_delete on public.user_follows;
create policy user_follows_delete on public.user_follows for delete to authenticated
  using (follower_id = (select public.current_user_id()));
drop policy if exists user_follows_read on public.user_follows;
create policy user_follows_read on public.user_follows for select to anon, authenticated using (true);
grant select on public.user_follows to anon, authenticated;
grant insert, delete on public.user_follows to authenticated;
grant all on public.user_follows to service_role;

create or replace function public.check_user_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.users u
    where u.id = new.followed_id
      and (u.role = 'brand' or not u.is_public or u.profile_hidden_at is not null)
  ) or new.follower_id = new.followed_id then
    raise exception 'No puedes seguir esta cuenta.' using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke execute on function public.check_user_follow() from public, anon, authenticated;
drop trigger if exists check_user_follow on public.user_follows;
create trigger check_user_follow before insert on public.user_follows
  for each row execute function public.check_user_follow();

-- ============================================================
-- 4. public_profiles: mismas columnas y orden; un perfil oculto no muestra nada extra; is_hidden al final.
--    SIN security_invoker a propósito (ver 20261120000000_user_identity.sql).
-- ============================================================
create or replace view public.public_profiles as
select u.id,
       u.handle,
       coalesce(nullif(btrim(u.display_name), ''), u.handle) as display_name,
       u.avatar_key,
       u.is_public,
       case when u.is_public and u.profile_hidden_at is null then u.bio end      as bio,
       case when u.is_public and u.profile_hidden_at is null then u.link_url end as link_url,
       case when u.is_public and u.profile_hidden_at is null then c.slug end     as city_slug,
       case when u.is_public and u.profile_hidden_at is null then c.name end     as city_name,
       (u.is_public and u.show_likes and u.profile_hidden_at is null)            as likes_visible,
       (u.role = 'brand')                                                        as is_brand_account,
       u.created_at,
       (u.profile_hidden_at is not null)                                         as is_hidden
from public.users u
left join public.cities c on c.id = u.home_city_id;

grant select on public.public_profiles to anon, authenticated, service_role;

-- ============================================================
-- 5. Nombre de usuario
-- ============================================================
create or replace function public.handle_available(p_handle text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
begin
  if p_handle is null or char_length(p_handle) < 3 or char_length(p_handle) > 24 then
    return 'Usa entre 3 y 24 caracteres.';
  end if;
  if p_handle !~ '^[a-z0-9](?:[a-z0-9._]{1,22})[a-z0-9]$' or position('..' in p_handle) > 0 then
    return 'Solo letras minúsculas, números, punto y guion bajo; empieza y termina con letra o número.';
  end if;
  if me is not null and exists (select 1 from public.users where id = me and handle_key = p_handle) then
    return null;
  end if;
  if exists (select 1 from public.reserved_handles where handle = p_handle)
     or p_handle ~ '^icon([._0-9]|$)'
     or exists (
       select 1 from public.brands b
       where b.is_active
         and regexp_replace(lower(b.slug), '[^a-z0-9]', '', 'g') = regexp_replace(p_handle, '[^a-z0-9]', '', 'g')
     ) then
    return 'Ese nombre está reservado.';
  end if;
  if exists (
    select 1 from public.tag_blocklist w
    where p_handle ~ ('(^|[^a-z0-9])' || w.word || '([^a-z0-9]|$)')
  ) then
    return 'Ese nombre no está permitido.';
  end if;
  if exists (select 1 from public.users where handle_key = p_handle) then
    return 'Ese nombre ya está en uso.';
  end if;
  return null;
end; $$;
revoke execute on function public.handle_available(text) from public;
grant execute on function public.handle_available(text) to anon, authenticated, service_role;

-- Un cambio cada 30 días. El primero desde el nombre automático (icon_xxxxxx) no cuenta.
create or replace function public.set_my_handle(p_handle text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
  cur record;
  err text;
  h text := lower(btrim(coalesce(p_handle, '')));
begin
  if me is null then raise exception 'Inicia sesión.' using errcode = 'P0001'; end if;
  select handle, handle_changed_at into cur from public.users where id = me;
  if cur.handle = h then return h; end if;
  err := public.handle_available(h);
  if err is not null then raise exception '%', err using errcode = 'P0001'; end if;
  if cur.handle_changed_at is not null and cur.handle_changed_at > now() - interval '30 days' then
    raise exception 'Podrás cambiar tu nombre de usuario el %.',
      to_char((cur.handle_changed_at + interval '30 days') at time zone 'America/Bogota', 'DD/MM/YYYY')
      using errcode = 'P0001';
  end if;
  perform set_config('icon.handle_change', 'on', true);
  update public.users
     set handle = h,
         handle_changed_at = case
           when cur.handle ~ '^icon_[0-9a-f]{6}$' and cur.handle_changed_at is null then null
           else now() end
   where id = me;
  perform set_config('icon.handle_change', '', true);
  return h;
end; $$;
revoke execute on function public.set_my_handle(text) from public, anon;
grant execute on function public.set_my_handle(text) to authenticated, service_role;

-- ============================================================
-- 6. Lectura del perfil: misma respuesta (null) para privado, oculto e inexistente.
-- ============================================================
create or replace function public.get_public_profile(p_handle text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
  u record;
  slug text;
  is_me boolean;
begin
  select * into u from public.users where handle_key = lower(btrim(coalesce(p_handle, '')));
  if not found then return null; end if;
  if u.role = 'brand' then
    select b.slug into slug from public.brands b
     where b.is_active and (b.id = u.brand_id or b.owner_user_id = u.id)
     order by (b.id = u.brand_id) desc limit 1;
    if slug is not null then return jsonb_build_object('redirect_brand_slug', slug); end if;
    return null;
  end if;
  is_me := me is not null and me = u.id;
  if (not u.is_public or u.profile_hidden_at is not null) and not is_me and not public.is_staff() then
    return null;
  end if;
  return jsonb_build_object(
    'id', u.id,
    'handle', u.handle,
    'display_name', coalesce(nullif(btrim(u.display_name), ''), u.handle),
    'avatar_key', u.avatar_key,
    'bio', u.bio,
    'link_url', u.link_url,
    'city_name', (select c.name from public.cities c where c.id = u.home_city_id),
    'is_public', u.is_public,
    'likes_visible', (u.is_public and u.show_likes and u.profile_hidden_at is null),
    'show_likes', u.show_likes,
    'is_hidden', u.profile_hidden_at is not null,
    'hidden_reason', case when is_me or public.is_staff() then u.profile_hidden_reason end,
    'is_me', is_me,
    'i_follow', me is not null and exists (
      select 1 from public.user_follows f where f.follower_id = me and f.followed_id = u.id),
    'counts', jsonb_build_object(
      'looks', (select count(*) from public.posts p
                where p.author_user_id = u.id and p.author_type = 'user' and p.status = 'published'),
      'followers', (select count(*) from public.user_follows f where f.followed_id = u.id),
      'following', (select count(*) from public.user_follows f where f.follower_id = u.id)
                 + (select count(*) from public.brand_follows bf where bf.user_id = u.id)
    )
  );
end; $$;
revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated, service_role;

-- Likes del perfil: solo con permiso (o para el dueño / el equipo). Orden por fecha del like.
create or replace function public.profile_liked(p_user_id uuid, p_kind text, p_limit int default 24, p_offset int default 0)
returns setof feed_items language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
begin
  if not (
    (me is not null and me = p_user_id)
    or public.is_staff()
    or exists (select 1 from public.users u where u.id = p_user_id and u.role <> 'brand'
               and u.is_public and u.show_likes and u.profile_hidden_at is null)
  ) then
    return;
  end if;
  if p_kind = 'garment' then
    return query
      select f.* from public.garment_likes l
      join feed_items f on f.kind = 'garment' and f.id = l.garment_id
      where l.user_id = p_user_id
      order by l.created_at desc, f.id
      limit least(greatest(p_limit, 1), 48) offset greatest(p_offset, 0);
  elsif p_kind = 'post' then
    return query
      select f.* from public.post_likes l
      join feed_items f on f.kind = 'post' and f.id = l.post_id
      where l.user_id = p_user_id
      order by l.created_at desc, f.id
      limit least(greatest(p_limit, 1), 48) offset greatest(p_offset, 0);
  end if;
end; $$;
revoke execute on function public.profile_liked(uuid, text, int, int) from public;
grant execute on function public.profile_liked(uuid, text, int, int) to anon, authenticated, service_role;

-- ============================================================
-- 7. Siguiendo
-- ============================================================
create or replace function public.get_following_feed(p_limit int default 24, p_offset int default 0)
returns setof feed_items language sql stable security definer set search_path = public as $$
  select f.* from feed_items f
  where (f.brand_id in (select bf.brand_id from public.brand_follows bf where bf.user_id = public.current_user_id()))
     or (f.author_user_id in (select uf.followed_id from public.user_follows uf where uf.follower_id = public.current_user_id()))
  order by f.published_at desc nulls last, f.id
  limit least(greatest(p_limit, 1), 48) offset greatest(p_offset, 0)
$$;
revoke execute on function public.get_following_feed(int, int) from public, anon;
grant execute on function public.get_following_feed(int, int) to authenticated, service_role;

create or replace function public.follow_suggestions()
returns table (kind text, id uuid, name text, slug_or_handle text, image text)
language sql stable security definer set search_path = public as $$
  (select 'brand'::text, b.id, b.name, b.slug, b.logo_url
     from public.brands b
    where b.is_active
      and not exists (select 1 from public.brand_follows bf where bf.brand_id = b.id and bf.user_id = public.current_user_id())
    order by (select count(*) from public.brand_follows bf where bf.brand_id = b.id) desc, b.name
    limit 6)
  union all
  (select 'user'::text, u.id, coalesce(nullif(btrim(u.display_name), ''), u.handle), u.handle, u.avatar_key
     from public.users u
    where u.role <> 'brand' and u.is_public and u.profile_hidden_at is null
      and u.id <> coalesce(public.current_user_id(), '00000000-0000-0000-0000-000000000000'::uuid)
      and not exists (select 1 from public.user_follows f where f.followed_id = u.id and f.follower_id = public.current_user_id())
      and exists (select 1 from public.posts p where p.author_user_id = u.id and p.author_type = 'user'
                  and p.status = 'published' and p.published_at > now() - interval '60 days')
    order by (select count(*) from public.posts p where p.author_user_id = u.id and p.author_type = 'user'
              and p.status = 'published' and p.published_at > now() - interval '60 days') desc, u.handle
    limit 6)
$$;
revoke execute on function public.follow_suggestions() from public, anon;
grant execute on function public.follow_suggestions() to authenticated, service_role;

create or replace function public.my_following()
returns table (kind text, id uuid, name text, slug_or_handle text, image text, followed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'brand'::text, b.id, b.name, b.slug, b.logo_url, bf.created_at
      from public.brand_follows bf join public.brands b on b.id = bf.brand_id
     where bf.user_id = public.current_user_id()
    union all
    select 'user'::text, u.id, coalesce(nullif(btrim(u.display_name), ''), u.handle), u.handle, u.avatar_key, f.created_at
      from public.user_follows f join public.users u on u.id = f.followed_id
     where f.follower_id = public.current_user_id()
  ) t
  order by 6 desc
$$;
revoke execute on function public.my_following() from public, anon;
grant execute on function public.my_following() to authenticated, service_role;

create or replace function public.mark_profile_notice_seen()
returns void language sql volatile security definer set search_path = public as $$
  update public.users set profile_notice_seen_at = now()
   where id = public.current_user_id() and profile_notice_seen_at is null
$$;
revoke execute on function public.mark_profile_notice_seen() from public, anon;
grant execute on function public.mark_profile_notice_seen() to authenticated, service_role;

-- ============================================================
-- 8. Equipo: ocultar / restaurar un perfil (resuelve sus reportes abiertos)
-- ============================================================
create or replace function public.set_profile_hidden(p_user_id uuid, p_hidden boolean, p_reason text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
begin
  if not public.is_staff() then raise exception 'Solo el equipo.' using errcode = '42501'; end if;
  perform set_config('icon.moderation', 'on', true);
  update public.users
     set profile_hidden_at = case when p_hidden then coalesce(profile_hidden_at, now()) end,
         profile_hidden_reason = case when p_hidden then nullif(btrim(coalesce(p_reason, '')), '') end
   where id = p_user_id;
  perform set_config('icon.moderation', '', true);
  update public.content_reports
     set status = case when p_hidden then 'actioned'::report_status else 'dismissed'::report_status end,
         resolved_by = me, resolved_at = now()
   where target_type = 'profile' and target_id = p_user_id and status = 'open';
end; $$;
revoke execute on function public.set_profile_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.set_profile_hidden(uuid, boolean, text) to authenticated, service_role;

-- Lista para el panel: perfiles ocultos.
create or replace function public.admin_hidden_profiles()
returns table (id uuid, handle text, display_name text, email text, profile_hidden_at timestamptz, profile_hidden_reason text)
language sql stable security definer set search_path = public as $$
  select u.id, u.handle, u.display_name, u.email, u.profile_hidden_at, u.profile_hidden_reason
    from public.users u
   where public.is_staff() and u.profile_hidden_at is not null
   order by u.profile_hidden_at desc
$$;
revoke execute on function public.admin_hidden_profiles() from public, anon;
grant execute on function public.admin_hidden_profiles() to authenticated, service_role;

-- ============================================================
-- 9. Índices
-- ============================================================
create index if not exists posts_user_published_idx on public.posts (author_user_id, published_at desc)
  where status = 'published' and author_type = 'user';
create index if not exists post_likes_user_idx on public.post_likes (user_id, created_at desc);
create index if not exists garment_likes_user_idx on public.garment_likes (user_id, created_at desc);
create index if not exists brand_follows_user_idx on public.brand_follows (user_id);
