-- Spec 011: reseñas de marcas (estrellas + comentario). Aditiva. Requiere la spec 008.
-- En la base se llaman `brand_ratings` para no confundirlas con `post_brand_reviews` (verificación de
-- etiquetas, spec 010). Funciones recreadas conservando su lógica:
--   protect_brand_curation_fields ← base: 20261201000000_claims.sql (spec 010)
--   report_content                ← base: 20261120010000_user_looks.sql (spec 008)
-- Toda función nueva lleva revoke/grant explícito (20261121000000_harden_table_privileges.sql).

do $$ begin
  create type rating_status as enum ('published', 'auto_hidden', 'removed');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 1. brand_ratings
-- ============================================================
create table if not exists public.brand_ratings (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brands (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  body        text not null check (char_length(btrim(body)) between 20 and 1000),
  status      rating_status not null default 'published',
  edited_at   timestamptz,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (brand_id, user_id)
);
create index if not exists brand_ratings_brand_idx on public.brand_ratings (brand_id, status, created_at desc);
create index if not exists brand_ratings_user_idx on public.brand_ratings (user_id, created_at desc);

drop trigger if exists brand_ratings_set_updated_at on public.brand_ratings;
create trigger brand_ratings_set_updated_at before update on public.brand_ratings
  for each row execute function public.set_updated_at();

alter table public.brand_ratings enable row level security;
drop policy if exists brand_ratings_read on public.brand_ratings;
create policy brand_ratings_read on public.brand_ratings for select to anon, authenticated
  using (
    (status = 'published' and exists (select 1 from public.brands b where b.id = brand_ratings.brand_id and b.is_active))
    or user_id = (select public.current_user_id())
  );
drop policy if exists brand_ratings_insert on public.brand_ratings;
create policy brand_ratings_insert on public.brand_ratings for insert to authenticated
  with check (user_id = (select public.current_user_id()));
drop policy if exists brand_ratings_update on public.brand_ratings;
create policy brand_ratings_update on public.brand_ratings for update to authenticated
  using (user_id = (select public.current_user_id()))
  with check (user_id = (select public.current_user_id()));
drop policy if exists brand_ratings_delete on public.brand_ratings;
create policy brand_ratings_delete on public.brand_ratings for delete to authenticated
  using (user_id = (select public.current_user_id()));
drop policy if exists brand_ratings_staff_all on public.brand_ratings;
create policy brand_ratings_staff_all on public.brand_ratings for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
grant select on public.brand_ratings to anon, authenticated;
grant insert, update, delete on public.brand_ratings to authenticated;
grant all on public.brand_ratings to service_role;

-- Reglas de escritura (mensajes que ve la persona).
create or replace function public.protect_brand_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  me users;
begin
  if auth.uid() is null or public.is_staff() then
    if tg_op = 'UPDATE' and (new.stars is distinct from old.stars or new.body is distinct from old.body) then
      new.edited_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'removed' then
      raise exception 'El equipo de Icon retiró esta reseña.' using errcode = 'check_violation';
    end if;
    if public.is_brand_owner(old.brand_id) then
      raise exception 'No puedes editar una reseña de tu propia marca.' using errcode = 'check_violation';
    end if;
    new.status := old.status;
    new.reviewed_at := old.reviewed_at;
    new.brand_id := old.brand_id;
    new.user_id := old.user_id;
    if new.stars is distinct from old.stars or new.body is distinct from old.body then
      new.edited_at := now();
    end if;
    new.body := btrim(new.body);
    return new;
  end if;

  -- INSERT
  new.status := 'published';
  new.reviewed_at := null;
  new.edited_at := null;
  new.body := btrim(new.body);
  select * into me from users where id = new.user_id;
  if not exists (select 1 from brands where id = new.brand_id and is_active) then
    raise exception 'Esta marca no está disponible.' using errcode = 'check_violation';
  end if;
  if public.is_brand_owner(new.brand_id) then
    raise exception 'No puedes reseñar tu propia marca.' using errcode = 'check_violation';
  end if;
  if me.role = 'brand' then
    raise exception 'Las cuentas de marca no pueden escribir reseñas.' using errcode = 'check_violation';
  end if;
  if me.posting_blocked_at is not null then
    raise exception 'Tu cuenta no puede publicar por ahora.' using errcode = 'check_violation';
  end if;
  if (select count(*) from brand_ratings where user_id = new.user_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Llegaste al límite de 5 reseñas por día.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
revoke execute on function public.protect_brand_rating() from public, anon, authenticated;
drop trigger if exists brand_ratings_protect on public.brand_ratings;
create trigger brand_ratings_protect before insert or update on public.brand_ratings
  for each row execute function public.protect_brand_rating();

-- ============================================================
-- 2. Resumen en brands
-- ============================================================
alter table public.brands add column if not exists rating_avg numeric(2,1);
alter table public.brands add column if not exists rating_count integer not null default 0;
alter table public.brands add column if not exists rating_dist integer[] not null default '{0,0,0,0,0}';

-- Conserva la lógica de la spec 010 y protege rating_* (solo los escribe refresh_brand_rating).
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
    if old.status not in ('pending', 'rejected') then
      new.claimed_stub_id := old.claimed_stub_id;
    end if;
  end if;
  if coalesce(current_setting('icon.rating_refresh', true), '') <> '1' then
    new.rating_avg := old.rating_avg;
    new.rating_count := old.rating_count;
    new.rating_dist := old.rating_dist;
  end if;
  if new.status is distinct from old.status then
    new.is_active := (new.status = 'active');
    if new.status = 'active' then new.rejection_note := null; end if;
  elsif restricted then
    new.is_active := old.is_active;
  end if;
  return new;
end; $$;

create or replace function public.refresh_brand_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  b uuid;
begin
  for b in select distinct x from unnest(array[
    case when tg_op <> 'INSERT' then old.brand_id end,
    case when tg_op <> 'DELETE' then new.brand_id end]) x where x is not null loop
    perform set_config('icon.rating_refresh', '1', true);
    update brands set
      rating_count = s.n,
      rating_avg = case when s.n > 0 then round(s.avg, 1) end,
      rating_dist = array[s.d1, s.d2, s.d3, s.d4, s.d5]
    from (
      select count(*)::int n, avg(stars)::numeric avg,
             count(*) filter (where stars = 1)::int d1, count(*) filter (where stars = 2)::int d2,
             count(*) filter (where stars = 3)::int d3, count(*) filter (where stars = 4)::int d4,
             count(*) filter (where stars = 5)::int d5
      from brand_ratings where brand_id = b and status = 'published'
    ) s
    where brands.id = b;
    perform set_config('icon.rating_refresh', '', true);
  end loop;
  return null;
end; $$;
revoke execute on function public.refresh_brand_rating() from public, anon, authenticated;
drop trigger if exists brand_ratings_refresh on public.brand_ratings;
create trigger brand_ratings_refresh after insert or update or delete on public.brand_ratings
  for each row execute function public.refresh_brand_rating();

-- ============================================================
-- 3. Reportes: report_content conserva lo de la 008 y añade reseñas
-- ============================================================
create or replace function public.report_content(
  p_target_type report_target, p_target_id uuid, p_reason report_reason, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
  p posts;
  r brand_ratings;
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
  elsif p_target_type = 'brand_review' then
    select * into r from brand_ratings where id = p_target_id;
    if not found or r.status = 'removed' then
      raise exception 'Esa reseña ya no está disponible.' using errcode = 'check_violation';
    end if;
    if r.user_id = me then
      raise exception 'No puedes reportar tu propia reseña.' using errcode = 'check_violation';
    end if;
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
  -- Lo mismo para reseñas (spec 011).
  if p_target_type = 'brand_review' and r.status = 'published' and r.reviewed_at is null
     and (select count(distinct reporter_user_id) from content_reports
          where target_type = 'brand_review' and target_id = p_target_id and status = 'open') >= 3 then
    update brand_ratings set status = 'auto_hidden' where id = p_target_id;
  end if;
  return jsonb_build_object('already', false);
end; $$;
revoke execute on function public.report_content(report_target, uuid, report_reason, text) from public, anon;
grant execute on function public.report_content(report_target, uuid, report_reason, text) to authenticated;

create or replace function public.moderate_brand_rating(p_rating_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo puede moderar.' using errcode = 'insufficient_privilege';
  end if;
  if p_action = 'remove' then
    update brand_ratings set status = 'removed' where id = p_rating_id;
    update content_reports set status = 'actioned', resolved_by = me, resolved_at = now()
     where target_type = 'brand_review' and target_id = p_rating_id and status = 'open';
  elsif p_action = 'restore' then
    update brand_ratings set status = 'published', reviewed_at = now() where id = p_rating_id;
    update content_reports set status = 'dismissed', resolved_by = me, resolved_at = now()
     where target_type = 'brand_review' and target_id = p_rating_id and status = 'open';
  else
    raise exception 'Acción no válida.' using errcode = 'check_violation';
  end if;
end; $$;
revoke execute on function public.moderate_brand_rating(uuid, text) from public, anon;
grant execute on function public.moderate_brand_rating(uuid, text) to authenticated, service_role;

-- ============================================================
-- 4. Lectura pública por tandas, con el autor desde public_profiles
-- ============================================================
create or replace function public.brand_ratings_page(
  p_brand_id uuid, p_sort text default 'recent', p_stars int default null, p_limit int default 10, p_offset int default 0)
returns table (id uuid, stars smallint, body text, created_at timestamptz, edited_at timestamptz,
               author_id uuid, author_handle text, author_name text, author_avatar text, author_public boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.stars, r.body, r.created_at, r.edited_at,
         pp.id, pp.handle, pp.display_name, pp.avatar_key, (pp.is_public and not pp.is_hidden)
    from brand_ratings r
    join brands b on b.id = r.brand_id and b.is_active
    join public_profiles pp on pp.id = r.user_id
   where r.brand_id = p_brand_id and r.status = 'published'
     and (p_stars is null or r.stars = p_stars)
   order by
     case when p_sort = 'high' then r.stars end desc,
     case when p_sort = 'low' then r.stars end asc,
     r.created_at desc, r.id
   limit least(greatest(coalesce(p_limit, 10), 1), 50) offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke execute on function public.brand_ratings_page(uuid, text, int, int, int) from public;
grant execute on function public.brand_ratings_page(uuid, text, int, int, int) to anon, authenticated, service_role;

-- Una reseña retirada por el equipo no se puede borrar para escribir otra (FR-012). El borrado en
-- cascada de una cuenta (pg_trigger_depth > 1) sí la borra (FR-014).
create or replace function public.protect_removed_rating_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'removed' and auth.uid() is not null and not public.is_staff() and pg_trigger_depth() = 1 then
    raise exception 'El equipo de Icon retiró esta reseña.' using errcode = 'check_violation';
  end if;
  return old;
end; $$;
revoke execute on function public.protect_removed_rating_delete() from public, anon, authenticated;
drop trigger if exists brand_ratings_protect_delete on public.brand_ratings;
create trigger brand_ratings_protect_delete before delete on public.brand_ratings
  for each row execute function public.protect_removed_rating_delete();
