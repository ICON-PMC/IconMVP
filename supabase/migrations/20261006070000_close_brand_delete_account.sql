-- Cerrar una marca y borrar la cuenta propia.
-- Spec: specs/2026-10-06-gestion-marcas-admin/plan.md, 1c y 1e.
--
-- Las imágenes de R2 no se pueden borrar desde la base: la server action lee sus claves antes de
-- llamar a estas funciones y las borra después (src/lib/r2.ts, deleteFromR2).
--
-- Qué se lleva la cascada al borrar `brands`: prendas (con imágenes, tags, tallas, likes,
-- guardados), looks (ídem), brand_tags, brand_follows, la conexión de Instagram y las reseñas de
-- marca. `outbound_clicks.brand_id/garment_id/post_id` son `on delete set null`: las métricas
-- quedan como filas anónimas.

-- Borra la marca y devuelve a su dueño a `user` (si tenía `brand`). Sin chequeo de permisos:
-- solo la llaman las dos funciones de abajo, que sí los chequean.
create or replace function public._delete_brand(p_brand_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
begin
  select owner_user_id into owner from brands where id = p_brand_id;
  if not found then
    raise exception 'No encontramos esa marca.' using errcode = 'no_data_found';
  end if;
  delete from brands where id = p_brand_id;
  if owner is not null then
    perform set_config('icon.role_change', 'on', true);
    update users set role = 'user' where id = owner and role = 'brand';
    perform set_config('icon.role_change', '', true);
  end if;
end; $$;

revoke execute on function public._delete_brand(uuid) from public, anon, authenticated;

-- La marca la cierra su dueño (Panel -> Perfil) o el staff (/admin -> Marcas).
create or replace function public.close_brand(p_brand_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_brand_owner(p_brand_id) or public.is_staff()) then
    raise exception 'No puedes cerrar esta marca.' using errcode = 'insufficient_privilege';
  end if;
  perform public._delete_brand(p_brand_id);
end; $$;

-- Borra la cuenta de quien la llama: su marca (si tiene) y su login en auth.users. La cascada
-- auth.users -> public.users se lleva guardados, likes, follows y preferencias.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := public.current_user_id();
  my_brand uuid;
begin
  if auth.uid() is null or me is null then
    raise exception 'Inicia sesión para borrar tu cuenta.' using errcode = 'insufficient_privilege';
  end if;
  if public.is_admin() and (select count(*) from public.users where role = 'admin') <= 1 then
    raise exception 'Eres el único admin: asigna otro admin antes de borrar tu cuenta.'
      using errcode = 'check_violation';
  end if;
  for my_brand in select id from public.brands where owner_user_id = me loop
    perform public._delete_brand(my_brand);
  end loop;
  delete from auth.users where id = auth.uid();
end; $$;

revoke execute on function public.close_brand(uuid) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.close_brand(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
