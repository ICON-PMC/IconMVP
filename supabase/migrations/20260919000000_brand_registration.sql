-- Registro de marcas con cola de aprobación (specs/2026-09-19-brand-registration, grupo 1).
-- Extiende brand_role + brand_self_serve: agrega ciclo de vida a `brands`, el vínculo
-- users.brand_id, y cierra los huecos por los que una marca podría auto-aprobarse o publicar
-- prendas antes de la revisión.

-- ============================================================
-- brands: estado de aprobación
-- ============================================================
create type brand_status as enum ('pending', 'active', 'rejected');

alter table brands
  add column status         brand_status not null default 'active',  -- default 'active': alta por staff
  add column rejection_note text,
  add column submitted_at   timestamptz;

-- Backfill: las marcas ya activas quedan 'active'; las de acceso propio aún inactivas, 'pending'.
update brands set status = case when is_active then 'active'::brand_status else 'pending'::brand_status end;

create index brands_status_idx on brands (status);

-- ============================================================
-- users.brand_id: vínculo directo usuario -> marca. La fuente de verdad sigue siendo
-- brands.owner_user_id (la RLS usa is_brand_owner); esto es un espejo mantenido por trigger.
-- ============================================================
alter table users add column brand_id uuid references brands (id) on delete set null;
create index users_brand_idx on users (brand_id) where brand_id is not null;

update users u set brand_id = b.id
from (select distinct on (owner_user_id) owner_user_id, id
      from brands where owner_user_id is not null order by owner_user_id, created_at) b
where u.id = b.owner_user_id;

create or replace function public.sync_user_brand_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.owner_user_id is distinct from new.owner_user_id and old.owner_user_id is not null then
    update public.users set brand_id = null where id = old.owner_user_id and brand_id = old.id;
  end if;
  if new.owner_user_id is not null then
    update public.users set brand_id = new.id where id = new.owner_user_id and brand_id is distinct from new.id;
  end if;
  return null;
end; $$;

create trigger brands_sync_user_brand_id
  after insert or update of owner_user_id on brands
  for each row execute function public.sync_user_brand_id();

-- users_update_own no restringe columnas: sin esto un usuario podría apuntar su brand_id a
-- cualquier marca. Solo se preserva en el nivel superior (pg_trigger_depth = 1); el trigger
-- de sincronización de arriba corre anidado y sí puede escribirlo.
create or replace function public.protect_user_role_field()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() and pg_trigger_depth() = 1 then
    if not (old.role = 'user' and new.role = 'brand') then
      new.role := old.role;
    end if;
    new.brand_id := old.brand_id;
  end if;
  return new;
end; $$;

-- ============================================================
-- brands: alta y edición por la propia marca
-- ============================================================
-- Los tres triggers de abajo solo restringen a usuarios autenticados (auth.uid() no nulo):
-- service_role / SQL directo no pasan por la RLS de una persona y pueden gestionar el estado.
-- INSERT por quien no es staff: siempre nace 'pending' e inactiva.
create or replace function public.protect_brand_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_staff() then
    new.status := 'pending';
    new.is_active := false;
    new.is_verified := false;
    new.rejection_note := null;
  end if;
  return new;
end; $$;

create trigger brands_protect_insert
  before insert on brands
  for each row execute function public.protect_brand_insert();

-- UPDATE: is_active se deriva de status; una marca no puede aprobarse a sí misma. Lo único
-- que puede mover de status es reenviar una marca rechazada (rejected -> pending), lo que
-- limpia la nota y reinicia submitted_at. Reemplaza la versión de brand_self_serve.
create or replace function public.protect_brand_curation_fields()
returns trigger language plpgsql security definer set search_path = public as $$
declare restricted boolean := auth.uid() is not null and not public.is_staff();
begin
  if restricted then
    new.is_verified := old.is_verified;
    new.rejection_note := old.rejection_note;
    if old.status = 'rejected' and new.status = 'pending' then
      new.rejection_note := null;
      new.submitted_at := now();
    else
      new.status := old.status;
      if old.status <> 'pending' then new.submitted_at := old.submitted_at; end if;
    end if;
  end if;
  if new.status is distinct from old.status then
    new.is_active := (new.status = 'active');
    if new.status = 'active' then new.rejection_note := null; end if;
  elsif restricted then
    new.is_active := old.is_active;
  end if;
  return new;
end; $$;

-- ============================================================
-- garments: una marca no aprobada no puede publicar. Sus prendas quedan 'pending' hasta
-- que staff apruebe la marca (la aprobación las publica en lote).
-- ============================================================
create or replace function public.protect_garment_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_staff() and new.status = 'published'
     and not exists (select 1 from public.brands b where b.id = new.brand_id and b.status = 'active') then
    new.status := 'pending';
  end if;
  return new;
end; $$;

create trigger garments_protect_status
  before insert or update on garments
  for each row execute function public.protect_garment_status();

-- Los GRANT de select/insert/update sobre brands, garments y users ya existen a nivel de tabla
-- (init + roles_and_staff); las columnas nuevas los heredan. Lectura pública de brands sigue
-- gateada por is_active (brands_read), y is_active solo es true con status = 'active'.
