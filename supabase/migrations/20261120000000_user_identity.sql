-- Spec 008, migración A: identidad pública de usuarios.
-- Aditiva y compatible con `main`: columnas nuevas, una vista nueva y dos funciones recreadas
-- conservando toda su lógica anterior.
--   handle_new_user        ← base: 20260619130000_oauth_display_name.sql
--   protect_user_role_field← base: 20261006060000_admin_users.sql

-- ============================================================
-- 1. Columnas nuevas de users
-- ============================================================
alter table public.users add column if not exists handle text;
alter table public.users add column if not exists handle_changed_at timestamptz;
alter table public.users add column if not exists avatar_key text;
alter table public.users add column if not exists avatar_bytes integer not null default 0;
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists link_url text;
alter table public.users add column if not exists is_public boolean not null default true;
alter table public.users add column if not exists show_likes boolean not null default true;
alter table public.users add column if not exists posting_blocked_at timestamptz;
alter table public.users add column if not exists posting_blocked_reason text;

alter table public.users drop constraint if exists users_handle_format;
alter table public.users add constraint users_handle_format check (
  handle is null or (
    handle ~ '^[a-z0-9](?:[a-z0-9._]{1,22})[a-z0-9]$' and position('..' in handle) = 0
  )
);
alter table public.users drop constraint if exists users_bio_len;
alter table public.users add constraint users_bio_len check (bio is null or char_length(bio) <= 160);
alter table public.users drop constraint if exists users_link_https;
alter table public.users add constraint users_link_https check (link_url is null or link_url ~ '^https://');
alter table public.users drop constraint if exists users_avatar_bytes_nonneg;
alter table public.users add constraint users_avatar_bytes_nonneg check (avatar_bytes >= 0);

alter table public.users add column if not exists handle_key text generated always as (lower(handle)) stored;
create unique index if not exists users_handle_key_idx on public.users (handle_key);

-- ============================================================
-- 2. Nombre de usuario por defecto: icon_ + 6 caracteres al azar, único.
-- ============================================================
create or replace function public.generate_handle()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  h text;
begin
  loop
    h := 'icon_' || substr(md5(gen_random_uuid()::text), 1, 6);
    exit when not exists (select 1 from public.users where handle_key = h);
  end loop;
  return h;
end; $$;
revoke execute on function public.generate_handle() from public, anon, authenticated;

-- handle_new_user: misma lógica de display_name (email / OAuth) + handle.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (auth_id, email, display_name, handle)
  values (
    new.id,
    new.email,
    nullif(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ), ''),
    public.generate_handle()
  );
  return new;
end; $$;

-- ============================================================
-- 3. Backfill: las cuentas existentes reciben handle y no muestran sus likes por defecto
--    (no lo eligieron). Las nuevas sí (show_likes default true).
-- ============================================================
update public.users set handle = public.generate_handle(), show_likes = false where handle is null;
alter table public.users alter column handle set not null;

-- ============================================================
-- 4. protect_user_role_field: conserva la lógica de rol y brand_id, y protege los campos de
--    moderación y el handle (la spec 009 añade set_my_handle()).
-- ============================================================
create or replace function public.protect_user_role_field()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and coalesce(current_setting('icon.role_change', true), '') <> 'on'
     and not (old.role = 'user' and new.role = 'brand') then
    new.role := old.role;
  end if;
  -- brand_id: igual que antes, solo lo escriben staff o el trigger de sincronización anidado.
  if not public.is_staff() and pg_trigger_depth() = 1 and auth.uid() is not null then
    new.brand_id := old.brand_id;
  end if;
  -- Moderación: solo el equipo (o SQL directo / service_role, o funciones security definer anidadas).
  if auth.uid() is not null and not public.is_staff()
     and coalesce(current_setting('icon.moderation', true), '') <> 'on' then
    new.posting_blocked_at := old.posting_blocked_at;
    new.posting_blocked_reason := old.posting_blocked_reason;
  end if;
  -- Handle: solo cambia desde set_my_handle() (spec 009), que marca icon.handle_change.
  if new.handle is distinct from old.handle
     and auth.uid() is not null
     and coalesce(current_setting('icon.handle_change', true), '') <> 'on' then
    new.handle := old.handle;
    new.handle_changed_at := old.handle_changed_at;
  end if;
  return new;
end; $$;

-- ============================================================
-- 5. public_profiles: la puerta pública a users.
--    SIN security_invoker a propósito: `users` solo deja leer la fila propia (users_select_own) y
--    abrir una policy pública sobre `users` expondría email, auth_id y rol a cualquier `select *`.
--    Esta vista lista columnas seguras y oculta bio, enlace y ciudad si el perfil no es público.
--    (El asesor de Supabase la marca como "security definer view": es deliberado, research R5.)
-- ============================================================
create or replace view public.public_profiles as
select u.id,
       u.handle,
       coalesce(nullif(btrim(u.display_name), ''), u.handle) as display_name,
       u.avatar_key,
       u.is_public,
       case when u.is_public then u.bio end      as bio,
       case when u.is_public then u.link_url end as link_url,
       case when u.is_public then c.slug end     as city_slug,
       case when u.is_public then c.name end     as city_name,
       (u.is_public and u.show_likes)            as likes_visible,
       (u.role = 'brand')                        as is_brand_account,
       u.created_at
from public.users u
left join public.cities c on c.id = u.home_city_id;

grant select on public.public_profiles to anon, authenticated, service_role;
