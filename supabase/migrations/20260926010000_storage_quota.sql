-- Cuota de almacenamiento en R2 por marca (roadmap Fase 0 · infraestructura).
--
-- Modelo: cada imagen guarda su peso en bytes (ya redimensionada a WebP), y el uso de una
-- marca es la SUMA de sus imágenes (prendas + posts + portada). Así el uso se mantiene
-- correcto al borrar prendas/posts (cascade) o al reemplazar la portada, sin contadores
-- que se desfasen. Las imágenes anteriores a esta migración quedan en 0 hasta correr
-- `npm run db:backfill-image-bytes`.
--
-- Cuota de usuario (50 MB): se agrega en la Fase 1, cuando los usuarios puedan subir outfits.
-- Hoy solo las marcas (y el staff en su nombre) suben imágenes.

alter table public.garment_images add column if not exists bytes integer not null default 0;
alter table public.post_images    add column if not exists bytes integer not null default 0;
alter table public.brands         add column if not exists logo_bytes integer not null default 0;

create or replace function public.brand_storage_bytes(p_brand_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(gi.bytes) from garment_images gi
              join garments g on g.id = gi.garment_id
              where g.brand_id = p_brand_id), 0)
  + coalesce((select sum(pi.bytes) from post_images pi
              join posts p on p.id = pi.post_id
              where p.author_brand_id = p_brand_id), 0)
  + coalesce((select b.logo_bytes from brands b where b.id = p_brand_id), 0);
$$;

-- Devuelve { allowed, used_bytes, limit_bytes } para subir p_bytes más a la marca.
-- security definer para sumar también borradores; solo la marca dueña o staff pueden consultarla.
create or replace function public.check_storage_quota(p_brand_id uuid, p_bytes bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit constant bigint := 314572800;  -- 300 MB
  v_used bigint;
begin
  if not (public.is_brand_owner(p_brand_id) or public.is_staff()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_used := public.brand_storage_bytes(p_brand_id);
  return jsonb_build_object(
    'allowed', v_used + greatest(p_bytes, 0) <= v_limit,
    'used_bytes', v_used,
    'limit_bytes', v_limit
  );
end;
$$;

revoke all on function public.brand_storage_bytes(uuid) from public, anon, authenticated;
grant execute on function public.brand_storage_bytes(uuid) to service_role;
revoke all on function public.check_storage_quota(uuid, bigint) from public, anon;
grant execute on function public.check_storage_quota(uuid, bigint) to authenticated, service_role;
