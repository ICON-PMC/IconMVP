-- Spec 010: las marcas revisan los looks que las etiquetan, reclaman prendas propuestas y las marcas
-- nuevas heredan sus menciones. Aditiva; requiere la spec 008 (brand_stubs, proposed_garments, …).
-- Funciones recreadas conservando su lógica (misma firma y retorno):
--   protect_brand_curation_fields ← base: 20260919000000_brand_registration.sql
--   approve_brand                 ← base: 20260919010000_brand_review_rpcs.sql
--   _delete_brand                 ← base: 20261006070000_close_brand_delete_account.sql
-- Toda función nueva lleva revoke/grant explícito (20261121000000_harden_table_privileges.sql).
-- Orden importante: el trigger post_proposed_items_cleanup (spec 008) borra una propuesta `open` que
-- se queda sin looks; por eso las funciones cambian el estado ANTES de borrar sus post_proposed_items.

-- ============================================================
-- 1. Columnas nuevas
-- ============================================================
alter table public.post_brand_reviews add column if not exists decided_by uuid references public.users (id) on delete set null;
alter table public.post_brand_reviews add column if not exists note text;
alter table public.post_brand_reviews add column if not exists updated_at timestamptz not null default now();
alter table public.post_brand_reviews drop constraint if exists post_brand_reviews_note_len;
alter table public.post_brand_reviews add constraint post_brand_reviews_note_len check (note is null or char_length(note) <= 280);
drop trigger if exists post_brand_reviews_set_updated_at on public.post_brand_reviews;
create trigger post_brand_reviews_set_updated_at before update on public.post_brand_reviews
  for each row execute function public.set_updated_at();

alter table public.proposed_garments add column if not exists claim_requested_brand_id uuid references public.brands (id) on delete set null;
alter table public.proposed_garments add column if not exists claim_requested_at timestamptz;
alter table public.proposed_garments drop constraint if exists proposed_garments_request_unbranded;
alter table public.proposed_garments add constraint proposed_garments_request_unbranded
  check (claim_requested_brand_id is null or (brand_id is null and brand_stub_id is null));
create index if not exists proposed_garments_brand_open_idx on public.proposed_garments (brand_id) where status = 'open';
create index if not exists proposed_garments_claimed_garment_idx on public.proposed_garments (claimed_garment_id) where claimed_garment_id is not null;

alter table public.brands add column if not exists claimed_stub_id uuid references public.brand_stubs (id) on delete set null;
create unique index if not exists brands_claimed_stub_pending_idx on public.brands (claimed_stub_id)
  where status = 'pending' and claimed_stub_id is not null;

-- La marca puede indicar su marca mencionada solo mientras su solicitud está pendiente.
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
  if new.status is distinct from old.status then
    new.is_active := (new.status = 'active');
    if new.status = 'active' then new.rejection_note := null; end if;
  elsif restricted then
    new.is_active := old.is_active;
  end if;
  return new;
end; $$;

-- Los campos de reclamo de una propuesta solo los escriben las funciones de esta spec o el equipo.
create or replace function public.protect_proposed_claim_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_staff()
     and coalesce(current_setting('icon.claims', true), '') <> 'on' then
    new.claim_requested_brand_id := old.claim_requested_brand_id;
    new.claim_requested_at := old.claim_requested_at;
    new.claimed_garment_id := old.claimed_garment_id;
  end if;
  return new;
end; $$;
revoke execute on function public.protect_proposed_claim_fields() from public, anon, authenticated;
drop trigger if exists proposed_garments_protect_claim on public.proposed_garments;
create trigger proposed_garments_protect_claim before update on public.proposed_garments
  for each row execute function public.protect_proposed_claim_fields();

-- ============================================================
-- 2. Tablas nuevas
-- ============================================================
create table if not exists public.claim_events (
  id                  uuid primary key default gen_random_uuid(),
  actor_user_id       uuid references public.users (id) on delete set null,
  action              text not null check (action in (
    'review_accept', 'review_decline', 'link_proposed', 'convert_proposed', 'converted_published',
    'disown_proposed', 'request_proposed', 'approve_request', 'reject_request', 'assign_proposed',
    'merge_proposed', 'discard_proposed', 'unlink_proposed', 'claim_stub', 'merge_stubs')),
  brand_id            uuid,
  brand_stub_id       uuid,
  proposed_garment_id uuid,
  garment_id          uuid,
  post_id             uuid,
  payload             jsonb not null default '{}',
  created_at          timestamptz not null default now()
);
create index if not exists claim_events_created_idx on public.claim_events (created_at desc);
create index if not exists claim_events_proposed_idx on public.claim_events (proposed_garment_id, created_at desc);
alter table public.claim_events enable row level security;
drop policy if exists claim_events_staff_read on public.claim_events;
create policy claim_events_staff_read on public.claim_events for select to authenticated using (public.is_staff());
grant select on public.claim_events to authenticated;
grant all on public.claim_events to service_role;

create table if not exists public.post_tag_notes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  text       text not null check (char_length(text) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists post_tag_notes_post_idx on public.post_tag_notes (post_id, created_at desc);
alter table public.post_tag_notes enable row level security;
drop policy if exists post_tag_notes_read on public.post_tag_notes;
create policy post_tag_notes_read on public.post_tag_notes for select to authenticated
  using (public.is_staff() or exists (select 1 from public.posts p where p.id = post_tag_notes.post_id
                                       and p.author_user_id = (select public.current_user_id())));
grant select on public.post_tag_notes to authenticated;
grant all on public.post_tag_notes to service_role;

-- ============================================================
-- 3. Lectura para marcas y autores
-- ============================================================
create or replace function public.is_any_brand_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.brands b where b.owner_user_id = public.current_user_id() and b.is_active)
$$;
revoke execute on function public.is_any_brand_owner() from public, anon;
grant execute on function public.is_any_brand_owner() to authenticated, service_role;

drop policy if exists post_brand_reviews_brand_read on public.post_brand_reviews;
create policy post_brand_reviews_brand_read on public.post_brand_reviews for select to authenticated
  using (public.is_brand_owner(brand_id));
drop policy if exists post_brand_reviews_author_read on public.post_brand_reviews;
create policy post_brand_reviews_author_read on public.post_brand_reviews for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_brand_reviews.post_id
                 and p.author_user_id = (select public.current_user_id())));
grant select on public.post_brand_reviews to authenticated;
grant all on public.post_brand_reviews to service_role;

drop policy if exists proposed_garments_brand_read on public.proposed_garments;
create policy proposed_garments_brand_read on public.proposed_garments for select to authenticated
  using (
    public.is_brand_owner(brand_id)
    or public.is_brand_owner(claim_requested_brand_id)
    or (status = 'open' and brand_id is null and brand_stub_id is null and public.is_any_brand_owner())
  );

-- ============================================================
-- 4. Ayudantes internos
-- ============================================================
create or replace function public._claim_event(
  p_action text, p_brand uuid default null, p_stub uuid default null, p_proposed uuid default null,
  p_garment uuid default null, p_post uuid default null, p_payload jsonb default '{}')
returns void language sql volatile security definer set search_path = public as $$
  insert into public.claim_events (actor_user_id, action, brand_id, brand_stub_id, proposed_garment_id, garment_id, post_id, payload)
  values (public.current_user_id(), p_action, p_brand, p_stub, p_proposed, p_garment, p_post, coalesce(p_payload, '{}'))
$$;
revoke execute on function public._claim_event(text, uuid, uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;

-- Reemplaza una prenda propuesta por una prenda del catálogo en todos sus looks. La propuesta debe
-- estar ya en un estado distinto de `open` (o el trigger de limpieza la borraría).
-- Devuelve { posts: [...], created: [...] } (created = looks donde la prenda no estaba antes).
create or replace function public._replace_proposed(p_proposed_id uuid, p_garment_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r record;
  posts uuid[] := '{}';
  created uuid[] := '{}';
begin
  for r in select ppi.id, ppi.post_id, ppi.position_x, ppi.position_y
             from post_proposed_items ppi where ppi.proposed_garment_id = p_proposed_id loop
    posts := posts || r.post_id;
    -- Primero se borra la propuesta (el límite de 10 etiquetas cuenta ambas).
    delete from post_proposed_items where id = r.id;
    if exists (select 1 from post_items where post_id = r.post_id and garment_id = p_garment_id) then
      update post_items set is_brand_verified = true where post_id = r.post_id and garment_id = p_garment_id;
    else
      insert into post_items (post_id, garment_id, position_x, position_y, is_brand_verified)
      values (r.post_id, p_garment_id, r.position_x, r.position_y, true);
      created := created || r.post_id;
    end if;
  end loop;
  return jsonb_build_object('posts', to_jsonb(posts), 'created', to_jsonb(created));
end; $$;
revoke execute on function public._replace_proposed(uuid, uuid) from public, anon, authenticated;

-- ============================================================
-- 5. Revisiones de etiquetas: se crean solas al publicar o etiquetar
-- ============================================================
create or replace function public.sync_post_brand_reviews()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_post uuid;
  v_brand uuid;
  verified boolean := false;
begin
  if tg_table_name = 'posts' then
    if new.author_type <> 'user' or new.status <> 'published' or old.status = 'published' then
      return null;
    end if;
    insert into post_brand_reviews (post_id, brand_id)
    select distinct new.id, b.id from (
      select g.brand_id as id from post_items it join garments g on g.id = it.garment_id where it.post_id = new.id
      union
      select m.brand_id from post_brand_mentions m where m.post_id = new.id and m.brand_id is not null
    ) x join brands b on b.id = x.id and b.is_active
    on conflict (post_id, brand_id) do nothing;
    return null;
  end if;

  v_post := new.post_id;
  if not exists (select 1 from posts p where p.id = v_post and p.author_type = 'user' and p.status = 'published') then
    return null;
  end if;
  if tg_table_name = 'post_items' then
    select g.brand_id into v_brand from garments g where g.id = new.garment_id;
    verified := new.is_brand_verified;
  else
    v_brand := new.brand_id;
  end if;
  if v_brand is null or not exists (select 1 from brands where id = v_brand and is_active) then
    return null;
  end if;
  if verified then
    -- La propia marca la reemplazó (prenda reclamada): no hace falta revisar.
    insert into post_brand_reviews (post_id, brand_id, status, decided_at)
    values (v_post, v_brand, 'accepted', now())
    on conflict (post_id, brand_id) do nothing;
  else
    insert into post_brand_reviews (post_id, brand_id) values (v_post, v_brand)
    on conflict (post_id, brand_id) do update set status = 'pending', decided_at = null, decided_by = null
      where post_brand_reviews.status <> 'pending';
  end if;
  return null;
end; $$;
revoke execute on function public.sync_post_brand_reviews() from public, anon, authenticated;

drop trigger if exists posts_sync_brand_reviews on public.posts;
create trigger posts_sync_brand_reviews after update of status on public.posts
  for each row execute function public.sync_post_brand_reviews();
drop trigger if exists post_items_sync_brand_reviews on public.post_items;
create trigger post_items_sync_brand_reviews after insert on public.post_items
  for each row execute function public.sync_post_brand_reviews();
drop trigger if exists post_brand_mentions_sync_brand_reviews on public.post_brand_mentions;
create trigger post_brand_mentions_sync_brand_reviews after insert on public.post_brand_mentions
  for each row execute function public.sync_post_brand_reviews();

create or replace function public.review_post_tag(p_post_id uuid, p_brand_id uuid, p_accept boolean, p_note text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_name text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not (public.is_brand_owner(p_brand_id) or public.is_staff()) then
    raise exception 'No puedes revisar etiquetas de esta marca.' using errcode = '42501';
  end if;
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'La nota puede tener hasta 280 caracteres.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from post_brand_reviews where post_id = p_post_id and brand_id = p_brand_id) then
    raise exception 'Este look ya no etiqueta a tu marca.' using errcode = 'P0001';
  end if;
  select name into v_name from brands where id = p_brand_id;

  if p_accept then
    update post_items it set is_brand_verified = true
      from garments g where g.id = it.garment_id and g.brand_id = p_brand_id and it.post_id = p_post_id;
    update post_brand_reviews set status = 'accepted', decided_at = now(), decided_by = public.current_user_id(), note = null
     where post_id = p_post_id and brand_id = p_brand_id;
    perform public._claim_event('review_accept', p_brand_id, null, null, null, p_post_id);
  else
    delete from post_items it using garments g
     where g.id = it.garment_id and g.brand_id = p_brand_id and it.post_id = p_post_id;
    delete from post_brand_mentions where post_id = p_post_id and brand_id = p_brand_id;
    update post_brand_reviews set status = 'declined', decided_at = now(), decided_by = public.current_user_id(), note = v_note
     where post_id = p_post_id and brand_id = p_brand_id;
    insert into post_tag_notes (post_id, text)
    values (p_post_id, left(v_name || ' indicó que lo etiquetado no es de su marca.', 200));
    perform public._claim_event('review_decline', p_brand_id, null, null, null, p_post_id, jsonb_build_object('note', v_note));
  end if;
end; $$;
revoke execute on function public.review_post_tag(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.review_post_tag(uuid, uuid, boolean, text) to authenticated, service_role;

-- ============================================================
-- 6. Prendas propuestas: acciones de la marca
-- ============================================================
create or replace function public.link_proposed_garment(p_proposed_id uuid, p_garment_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  pg proposed_garments;
  g garments;
  res jsonb;
begin
  select * into pg from proposed_garments where id = p_proposed_id for update;
  if not found or pg.status <> 'open' then
    raise exception 'Esta prenda ya no está disponible para reclamar.' using errcode = 'P0001';
  end if;
  select * into g from garments where id = p_garment_id;
  if not found or g.status <> 'published' then
    raise exception 'Elige una prenda publicada de tu catálogo.' using errcode = 'P0001';
  end if;
  if not public.is_staff() then
    if not public.is_brand_owner(g.brand_id) or pg.brand_id is distinct from g.brand_id then
      raise exception 'Solo puedes enlazar prendas propuestas con el nombre de tu marca.' using errcode = '42501';
    end if;
  end if;
  perform set_config('icon.claims', 'on', true);
  update proposed_garments set status = 'claimed', claimed_garment_id = p_garment_id, brand_id = g.brand_id, brand_stub_id = null,
         claim_requested_brand_id = null, claim_requested_at = null
   where id = p_proposed_id;
  res := public._replace_proposed(p_proposed_id, p_garment_id);
  perform set_config('icon.claims', '', true);
  perform public._claim_event('link_proposed', g.brand_id, null, p_proposed_id, p_garment_id, null, res);
end; $$;
revoke execute on function public.link_proposed_garment(uuid, uuid) from public, anon;
grant execute on function public.link_proposed_garment(uuid, uuid) to authenticated, service_role;

-- Crea la prenda del catálogo (pendiente) a partir de la propuesta; al publicarla, reemplaza.
create or replace function public.start_proposed_garment_conversion(p_proposed_id uuid)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  pg proposed_garments;
  v_id uuid;
begin
  select * into pg from proposed_garments where id = p_proposed_id for update;
  if not found or pg.status <> 'open' or pg.brand_id is null then
    raise exception 'Esta prenda ya no está disponible para reclamar.' using errcode = 'P0001';
  end if;
  if not (public.is_brand_owner(pg.brand_id) or public.is_staff()) then
    raise exception 'Solo puedes reclamar prendas propuestas con el nombre de tu marca.' using errcode = '42501';
  end if;
  if pg.claimed_garment_id is not null
     and exists (select 1 from garments where id = pg.claimed_garment_id and brand_id = pg.brand_id and status <> 'published') then
    return pg.claimed_garment_id;
  end if;
  insert into garments (brand_id, title, status, source, created_by_user_id)
  values (pg.brand_id, pg.name, 'pending', 'user_proposed', pg.created_by_user_id)
  returning id into v_id;
  insert into garment_tags (garment_id, tag_id) values (v_id, pg.category_tag_id) on conflict do nothing;
  insert into garment_colors (garment_id, color_id)
    select v_id, color_id from proposed_garment_colors where proposed_garment_id = p_proposed_id
  on conflict do nothing;
  perform set_config('icon.claims', 'on', true);
  update proposed_garments set claimed_garment_id = v_id where id = p_proposed_id;
  perform set_config('icon.claims', '', true);
  perform public._claim_event('convert_proposed', pg.brand_id, null, p_proposed_id, v_id);
  return v_id;
end; $$;
revoke execute on function public.start_proposed_garment_conversion(uuid) from public, anon;
grant execute on function public.start_proposed_garment_conversion(uuid) to authenticated, service_role;

create or replace function public.on_garment_published()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pg record;
  res jsonb;
begin
  if new.status <> 'published' or old.status = 'published' then return null; end if;
  for pg in select id from proposed_garments where claimed_garment_id = new.id and status = 'open' loop
    perform set_config('icon.claims', 'on', true);
    update proposed_garments set status = 'claimed', brand_id = new.brand_id, brand_stub_id = null where id = pg.id;
    res := public._replace_proposed(pg.id, new.id);
    perform set_config('icon.claims', '', true);
    perform public._claim_event('converted_published', new.brand_id, null, pg.id, new.id, null, res);
  end loop;
  return null;
end; $$;
revoke execute on function public.on_garment_published() from public, anon, authenticated;
drop trigger if exists garments_on_published_claim on public.garments;
create trigger garments_on_published_claim after update of status on public.garments
  for each row execute function public.on_garment_published();

create or replace function public.disown_proposed_garment(p_proposed_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare pg proposed_garments;
begin
  select * into pg from proposed_garments where id = p_proposed_id for update;
  if not found or pg.status <> 'open' or pg.brand_id is null then
    raise exception 'Esta prenda ya no está disponible.' using errcode = 'P0001';
  end if;
  if not (public.is_brand_owner(pg.brand_id) or public.is_staff()) then
    raise exception 'Solo puedes responder por prendas con el nombre de tu marca.' using errcode = '42501';
  end if;
  perform set_config('icon.claims', 'on', true);
  update proposed_garments set brand_id = null, brand_stub_id = null, claimed_garment_id = null where id = p_proposed_id;
  perform set_config('icon.claims', '', true);
  -- Si había empezado a convertirla, la prenda pendiente queda en su catálogo como borrador.
  perform public._claim_event('disown_proposed', pg.brand_id, null, p_proposed_id);
end; $$;
revoke execute on function public.disown_proposed_garment(uuid) from public, anon;
grant execute on function public.disown_proposed_garment(uuid) to authenticated, service_role;

create or replace function public.request_proposed_garment(p_proposed_id uuid, p_brand_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare pg proposed_garments;
begin
  if not (public.is_brand_owner(p_brand_id) and exists (select 1 from brands where id = p_brand_id and is_active)) then
    raise exception 'Solo puedes pedir prendas para tu marca.' using errcode = '42501';
  end if;
  select * into pg from proposed_garments where id = p_proposed_id for update;
  if not found or pg.status <> 'open' or pg.brand_id is not null or pg.brand_stub_id is not null then
    raise exception 'Esta prenda ya tiene marca.' using errcode = 'P0001';
  end if;
  if pg.claim_requested_brand_id is not null then
    raise exception 'Otra solicitud por esta prenda está en revisión.' using errcode = 'P0001';
  end if;
  perform set_config('icon.claims', 'on', true);
  update proposed_garments set claim_requested_brand_id = p_brand_id, claim_requested_at = now() where id = p_proposed_id;
  perform set_config('icon.claims', '', true);
  perform public._claim_event('request_proposed', p_brand_id, null, p_proposed_id);
end; $$;
revoke execute on function public.request_proposed_garment(uuid, uuid) from public, anon;
grant execute on function public.request_proposed_garment(uuid, uuid) to authenticated, service_role;

-- ============================================================
-- 7. Prendas propuestas: acciones del equipo
-- ============================================================
create or replace function public._require_staff()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Solo el equipo de Icon.' using errcode = '42501'; end if;
end; $$;
revoke execute on function public._require_staff() from public, anon, authenticated;

create or replace function public.resolve_proposed_claim(p_proposed_id uuid, p_approve boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
declare pg proposed_garments;
begin
  perform public._require_staff();
  select * into pg from proposed_garments where id = p_proposed_id for update;
  if not found or pg.claim_requested_brand_id is null then
    raise exception 'No hay una solicitud por esta prenda.' using errcode = 'P0001';
  end if;
  if p_approve then
    update proposed_garments set brand_id = claim_requested_brand_id, claim_requested_brand_id = null, claim_requested_at = null
     where id = p_proposed_id;
  else
    update proposed_garments set claim_requested_brand_id = null, claim_requested_at = null where id = p_proposed_id;
  end if;
  perform public._claim_event(case when p_approve then 'approve_request' else 'reject_request' end,
                              pg.claim_requested_brand_id, null, p_proposed_id);
end; $$;
revoke execute on function public.resolve_proposed_claim(uuid, boolean) from public, anon;
grant execute on function public.resolve_proposed_claim(uuid, boolean) to authenticated, service_role;

create or replace function public.assign_proposed_garment_brand(p_proposed_id uuid, p_brand_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._require_staff();
  if not exists (select 1 from brands where id = p_brand_id and is_active) then
    raise exception 'Elige una marca activa.' using errcode = 'P0001';
  end if;
  update proposed_garments
     set brand_id = p_brand_id, brand_stub_id = null, claim_requested_brand_id = null, claim_requested_at = null
   where id = p_proposed_id and status = 'open';
  if not found then raise exception 'Esta prenda ya no está abierta.' using errcode = 'P0001'; end if;
  perform public._claim_event('assign_proposed', p_brand_id, null, p_proposed_id);
end; $$;
revoke execute on function public.assign_proposed_garment_brand(uuid, uuid) from public, anon;
grant execute on function public.assign_proposed_garment_brand(uuid, uuid) to authenticated, service_role;

create or replace function public.merge_proposed_garments(p_from uuid, p_into uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._require_staff();
  if p_from = p_into then raise exception 'Elige dos prendas distintas.' using errcode = 'P0001'; end if;
  if not exists (select 1 from proposed_garments where id = p_from and status = 'open')
     or not exists (select 1 from proposed_garments where id = p_into and status = 'open') then
    raise exception 'Las dos prendas deben estar abiertas.' using errcode = 'P0001';
  end if;
  -- Se borra primero la de origen (cascada a sus filas) y se recrean las que faltan en la de destino.
  create temp table if not exists _merge_items (post_id uuid, position_x real, position_y real, position int) on commit drop;
  delete from _merge_items;
  insert into _merge_items select post_id, position_x, position_y, position from post_proposed_items where proposed_garment_id = p_from;
  update proposed_garments set status = 'rejected' where id = p_from;  -- evita el borrado por limpieza a mitad
  delete from post_proposed_items where proposed_garment_id = p_from;
  insert into post_proposed_items (post_id, proposed_garment_id, position, position_x, position_y)
    select m.post_id, p_into, m.position, m.position_x, m.position_y from _merge_items m
  on conflict (post_id, proposed_garment_id) do nothing;
  delete from proposed_garments where id = p_from;
  perform public._claim_event('merge_proposed', null, null, p_into, null, null, jsonb_build_object('from', p_from));
end; $$;
revoke execute on function public.merge_proposed_garments(uuid, uuid) from public, anon;
grant execute on function public.merge_proposed_garments(uuid, uuid) to authenticated, service_role;

create or replace function public.discard_proposed_garment(p_proposed_id uuid, p_note text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  pg proposed_garments;
  posts uuid[];
begin
  perform public._require_staff();
  select * into pg from proposed_garments where id = p_proposed_id for update;
  if not found or pg.status <> 'open' then raise exception 'Esta prenda ya no está abierta.' using errcode = 'P0001'; end if;
  select coalesce(array_agg(post_id), '{}') into posts from post_proposed_items where proposed_garment_id = p_proposed_id;
  update proposed_garments set status = 'rejected' where id = p_proposed_id;
  delete from post_proposed_items where proposed_garment_id = p_proposed_id;
  insert into post_tag_notes (post_id, text)
    select unnest(posts), left('El equipo de Icon quitó «' || pg.name || '».', 200);
  perform public._claim_event('discard_proposed', pg.brand_id, pg.brand_stub_id, p_proposed_id, null, null,
                              jsonb_build_object('posts', to_jsonb(posts), 'note', nullif(btrim(coalesce(p_note, '')), '')));
end; $$;
revoke execute on function public.discard_proposed_garment(uuid, text) from public, anon;
grant execute on function public.discard_proposed_garment(uuid, text) to authenticated, service_role;

-- Deshace el último enlace (manual o por publicación) de los últimos 30 días.
create or replace function public.unlink_proposed_garment(p_proposed_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  pg proposed_garments;
  ev claim_events;
  p uuid;
begin
  perform public._require_staff();
  select * into pg from proposed_garments where id = p_proposed_id for update;
  if not found or pg.status <> 'claimed' then raise exception 'Esta prenda no está enlazada.' using errcode = 'P0001'; end if;
  select * into ev from claim_events
   where proposed_garment_id = p_proposed_id and action in ('link_proposed', 'converted_published')
   order by created_at desc limit 1;
  if not found or ev.created_at < now() - interval '30 days' then
    raise exception 'Solo se puede deshacer un enlace de los últimos 30 días.' using errcode = 'P0001';
  end if;
  update proposed_garments set status = 'open', claimed_garment_id = null where id = p_proposed_id;
  for p in select (jsonb_array_elements_text(ev.payload -> 'created'))::uuid loop
    delete from post_items where post_id = p and garment_id = ev.garment_id;
  end loop;
  for p in select (jsonb_array_elements_text(ev.payload -> 'posts'))::uuid loop
    if exists (select 1 from posts where id = p) then
      update post_items set is_brand_verified = false where post_id = p and garment_id = ev.garment_id;
      insert into post_proposed_items (post_id, proposed_garment_id) values (p, p_proposed_id)
      on conflict (post_id, proposed_garment_id) do nothing;
    end if;
  end loop;
  perform public._claim_event('unlink_proposed', ev.brand_id, null, p_proposed_id, ev.garment_id, null, ev.payload);
end; $$;
revoke execute on function public.unlink_proposed_garment(uuid) from public, anon;
grant execute on function public.unlink_proposed_garment(uuid) to authenticated, service_role;

-- ============================================================
-- 8. Marcas mencionadas
-- ============================================================
-- Pasa las menciones y propuestas de un stub a una marca (equipo, o desde approve_brand).
create or replace function public.claim_brand_stub(p_stub_id uuid, p_brand_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare n_mentions int;
begin
  perform public._require_staff();
  if not exists (select 1 from brands where id = p_brand_id and is_active) then
    raise exception 'Elige una marca activa.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from brand_stubs where id = p_stub_id and status <> 'claimed') then
    raise exception 'Esa marca mencionada ya fue asignada.' using errcode = 'P0001';
  end if;
  delete from post_brand_mentions m
   where m.brand_stub_id = p_stub_id
     and exists (select 1 from post_brand_mentions x where x.post_id = m.post_id and x.brand_id = p_brand_id);
  update post_brand_mentions set brand_id = p_brand_id, brand_stub_id = null where brand_stub_id = p_stub_id;
  get diagnostics n_mentions = row_count;
  update proposed_garments set brand_id = p_brand_id, brand_stub_id = null where brand_stub_id = p_stub_id;
  update brand_stubs set status = 'claimed', claimed_brand_id = p_brand_id where id = p_stub_id;
  insert into post_brand_reviews (post_id, brand_id)
    select distinct m.post_id, p_brand_id from post_brand_mentions m join posts p on p.id = m.post_id
     where m.brand_id = p_brand_id and p.author_type = 'user' and p.status = 'published'
  on conflict (post_id, brand_id) do nothing;
  perform public._claim_event('claim_stub', p_brand_id, p_stub_id, null, null, null, jsonb_build_object('mentions', n_mentions));
end; $$;
revoke execute on function public.claim_brand_stub(uuid, uuid) from public, anon;
grant execute on function public.claim_brand_stub(uuid, uuid) to authenticated, service_role;

create or replace function public.merge_brand_stubs(p_from uuid, p_into uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._require_staff();
  if p_from = p_into then raise exception 'Elige dos marcas distintas.' using errcode = 'P0001'; end if;
  if not exists (select 1 from brand_stubs where id = p_into and status = 'open') then
    raise exception 'La marca de destino debe estar abierta.' using errcode = 'P0001';
  end if;
  delete from post_brand_mentions m
   where m.brand_stub_id = p_from
     and exists (select 1 from post_brand_mentions x where x.post_id = m.post_id and x.brand_stub_id = p_into);
  update post_brand_mentions set brand_stub_id = p_into where brand_stub_id = p_from;
  update proposed_garments set brand_stub_id = p_into where brand_stub_id = p_from;
  update brands set claimed_stub_id = p_into where claimed_stub_id = p_from and status = 'pending'
    and not exists (select 1 from brands b2 where b2.claimed_stub_id = p_into and b2.status = 'pending');
  delete from brand_stubs where id = p_from;
  perform public._claim_event('merge_stubs', null, p_into, null, null, null, jsonb_build_object('from', p_from));
end; $$;
revoke execute on function public.merge_brand_stubs(uuid, uuid) from public, anon;
grant execute on function public.merge_brand_stubs(uuid, uuid) to authenticated, service_role;

create or replace function public.brand_stub_mentions(p_stub_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct m.post_id)::int from post_brand_mentions m join posts p on p.id = m.post_id
   where m.brand_stub_id = p_stub_id and p.status = 'published'
$$;
revoke execute on function public.brand_stub_mentions(uuid) from public;
grant execute on function public.brand_stub_mentions(uuid) to anon, authenticated, service_role;

create or replace function public.suggest_brand_stubs(p_name text)
returns table (id uuid, name text, mentions int)
language sql stable security definer set search_path = public as $$
  with k as (select public.brand_name_key(p_name) as key)
  select s.id, s.name, public.brand_stub_mentions(s.id)
    from brand_stubs s, k
   where s.status = 'open' and char_length(k.key) >= 2
     and (s.name_key = k.key or s.name_key like '%' || k.key || '%' or extensions.similarity(s.name_key, k.key) >= 0.3)
   order by (s.name_key = k.key) desc, extensions.similarity(s.name_key, k.key) desc, s.name
   limit 5
$$;
revoke execute on function public.suggest_brand_stubs(text) from public, anon;
grant execute on function public.suggest_brand_stubs(text) to authenticated, service_role;

create or replace function public.my_brand_inbox_counts(p_brand_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_brand_owner(p_brand_id) or public.is_staff()) then
    raise exception 'No puedes ver la bandeja de esta marca.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'reviews_pending', (select count(*) from post_brand_reviews r join posts p on p.id = r.post_id
                         where r.brand_id = p_brand_id and r.status = 'pending' and p.status = 'published'),
    'proposed_pending', (select count(*) from proposed_garments where brand_id = p_brand_id and status = 'open'),
    'unbranded_open', (select count(*) from proposed_garments
                        where status = 'open' and brand_id is null and brand_stub_id is null)
  );
end; $$;
revoke execute on function public.my_brand_inbox_counts(uuid) from public, anon;
grant execute on function public.my_brand_inbox_counts(uuid) to authenticated, service_role;

-- ============================================================
-- 9. approve_brand y _delete_brand (misma firma y retorno)
-- ============================================================
create or replace function public.approve_brand(p_brand_id uuid)
returns table (brand_name text, owner_email text)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_stub uuid;
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update brands
     set status = 'active', is_active = true, rejection_note = null
   where id = p_brand_id and status = 'pending'
  returning brands.name, brands.owner_user_id, brands.claimed_stub_id into brand_name, v_owner, v_stub;
  if not found then
    raise exception 'La marca ya no está pendiente de revisión.' using errcode = 'P0001';
  end if;

  -- Las prendas enviadas con la solicitud se publican en lote.
  update garments
     set status = 'published', published_at = coalesce(published_at, now())
   where brand_id = p_brand_id and status = 'pending';

  -- Spec 010: hereda las menciones de la marca mencionada que indicó en su registro.
  if v_stub is not null and exists (select 1 from brand_stubs where id = v_stub and status = 'open') then
    perform public.claim_brand_stub(v_stub, p_brand_id);
  end if;

  select u.email into owner_email from users u where u.id = v_owner;
  return next;
end; $$;
revoke all on function public.approve_brand(uuid) from public, anon;
grant execute on function public.approve_brand(uuid) to authenticated;

create or replace function public._delete_brand(p_brand_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  v_name text;
  v_key text;
  v_stub uuid;
begin
  select owner_user_id, name into owner, v_name from brands where id = p_brand_id;
  if not found then
    raise exception 'No encontramos esa marca.' using errcode = 'no_data_found';
  end if;

  -- Spec 010: los looks que la mencionaban conservan la mención como marca mencionada (stub).
  if exists (select 1 from post_brand_mentions where brand_id = p_brand_id) then
    v_key := public.brand_name_key(v_name);
    select id into v_stub from brand_stubs where claimed_brand_id = p_brand_id or name_key = v_key
      order by (claimed_brand_id = p_brand_id) desc nulls last limit 1;
    if v_stub is null then
      insert into brand_stubs (name) values (left(btrim(v_name), 60)) returning id into v_stub;
    else
      update brand_stubs set status = 'open', claimed_brand_id = null where id = v_stub;
    end if;
    delete from post_brand_mentions m
     where m.brand_id = p_brand_id
       and exists (select 1 from post_brand_mentions x where x.post_id = m.post_id and x.brand_stub_id = v_stub);
    update post_brand_mentions set brand_id = null, brand_stub_id = v_stub where brand_id = p_brand_id;
  end if;

  delete from brands where id = p_brand_id;
  if owner is not null then
    perform set_config('icon.role_change', 'on', true);
    update users set role = 'user' where id = owner and role = 'brand';
    perform set_config('icon.role_change', '', true);
  end if;
end; $$;
revoke execute on function public._delete_brand(uuid) from public, anon, authenticated;

-- ============================================================
-- 10. Backfill: revisiones pendientes para looks de usuario ya publicados
-- ============================================================
insert into public.post_brand_reviews (post_id, brand_id)
select distinct x.post_id, x.brand_id from (
  select it.post_id, g.brand_id from public.post_items it join public.garments g on g.id = it.garment_id
  union
  select m.post_id, m.brand_id from public.post_brand_mentions m where m.brand_id is not null
) x
join public.posts p on p.id = x.post_id and p.author_type = 'user' and p.status = 'published'
join public.brands b on b.id = x.brand_id and b.is_active
on conflict (post_id, brand_id) do nothing;
