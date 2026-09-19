-- Cola de aprobación de marcas (specs/2026-09-19-brand-registration, grupo 5).
-- Aprobar/rechazar son RPC atómicas para que la marca y sus prendas nunca queden a medias
-- (p.ej. marca activa con las prendas aún en 'pending'). Solo staff (curator/admin).
-- Devuelven el nombre de la marca y el correo de su dueño para que la app envíe la notificación
-- (staff no puede leer la fila de otro usuario en `users`; esta función security definer sí).

create or replace function public.approve_brand(p_brand_id uuid)
returns table (brand_name text, owner_email text)
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update brands
     set status = 'active', is_active = true, rejection_note = null
   where id = p_brand_id and status = 'pending'
  returning brands.name, brands.owner_user_id into brand_name, v_owner;
  if not found then
    raise exception 'La marca ya no está pendiente de revisión.' using errcode = 'P0001';
  end if;

  -- Las prendas enviadas con la solicitud se publican en lote.
  update garments
     set status = 'published', published_at = coalesce(published_at, now())
   where brand_id = p_brand_id and status = 'pending';

  select u.email into owner_email from users u where u.id = v_owner;
  return next;
end; $$;

create or replace function public.reject_brand(p_brand_id uuid, p_note text default null)
returns table (brand_name text, owner_email text)
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update brands
     set status = 'rejected', is_active = false, rejection_note = nullif(btrim(p_note), '')
   where id = p_brand_id and status = 'pending'
  returning brands.name, brands.owner_user_id into brand_name, v_owner;
  if not found then
    raise exception 'La marca ya no está pendiente de revisión.' using errcode = 'P0001';
  end if;
  -- Las prendas se quedan 'pending': si la marca reenvía y se aprueba, se publican entonces.

  select u.email into owner_email from users u where u.id = v_owner;
  return next;
end; $$;

revoke all on function public.approve_brand(uuid) from public, anon;
revoke all on function public.reject_brand(uuid, text) from public, anon;
grant execute on function public.approve_brand(uuid) to authenticated;
grant execute on function public.reject_brand(uuid, text) to authenticated;
