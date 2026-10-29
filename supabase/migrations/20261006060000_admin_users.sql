-- Gestión de usuarios y roles desde /admin (solo admin cambia roles).
-- Spec: specs/2026-10-06-gestion-marcas-admin/plan.md, 1b.
--
-- Hueco que cierra: `users_update_own` deja a cada quien editar su propia fila y el trigger
-- `protect_user_role_field` no limitaba el rol si quien edita es staff, así que un curator podía
-- ponerse `role = 'admin'` con un PATCH directo a la API. Ahora un cambio de rol solo pasa si:
--   - viene de `set_user_role` / `close_brand` / `delete_my_account` (marcan `icon.role_change`),
--   - es el `user -> brand` del registro de marca, o
--   - no hay usuario autenticado (SQL directo / service_role).

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where auth_id = auth.uid() and role = 'admin');
$$;

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
  return new;
end; $$;

-- ============================================================
-- Lista de usuarios (staff). `users` solo deja leer la fila propia, por eso security definer.
-- ============================================================
create or replace function public.admin_list_users(q text default null)
returns table (
  id uuid, email text, display_name text, role user_role,
  brand_id uuid, brand_name text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo puede ver la lista de usuarios.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select u.id, u.email, u.display_name, u.role, b.id, b.name, u.created_at
    from users u
    left join brands b on b.owner_user_id = u.id
    where q is null or btrim(q) = ''
       or public.f_unaccent(lower(coalesce(u.email, '') || ' ' || coalesce(u.display_name, '')))
          like '%' || public.f_unaccent(lower(btrim(q))) || '%'
    order by u.created_at desc;
end; $$;

-- ============================================================
-- Cambiar rol (solo admin). Ni el propio rol ni dejar el sistema sin admins.
-- ============================================================
create or replace function public.set_user_role(p_user_id uuid, p_role user_role)
returns void language plpgsql security definer set search_path = public as $$
declare
  old_role user_role;
begin
  if not public.is_admin() then
    raise exception 'Solo un admin puede cambiar roles.' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id = public.current_user_id() then
    raise exception 'No puedes cambiar tu propio rol.' using errcode = 'check_violation';
  end if;
  select role into old_role from users where id = p_user_id;
  if old_role is null then
    raise exception 'No encontramos ese usuario.' using errcode = 'no_data_found';
  end if;
  if old_role = 'admin' and p_role <> 'admin'
     and (select count(*) from users where role = 'admin') <= 1 then
    raise exception 'Debe quedar al menos un admin.' using errcode = 'check_violation';
  end if;
  perform set_config('icon.role_change', 'on', true);
  update users set role = p_role where id = p_user_id;
  perform set_config('icon.role_change', '', true);
end; $$;

revoke execute on function public.admin_list_users(text) from public, anon;
revoke execute on function public.set_user_role(uuid, user_role) from public, anon;
grant execute on function public.admin_list_users(text) to authenticated;
grant execute on function public.set_user_role(uuid, user_role) to authenticated;
