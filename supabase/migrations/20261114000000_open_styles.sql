-- Vocabulario abierto de estilos (spec 004-etiquetado-abierto-ia, FR-001 a FR-014).
-- Cambia la decisión 1 del spec 2026-10-06 ("sin etiquetas libres"): marcas y equipo crean
-- estilos nuevos que quedan públicos de inmediato. Categoría y clima siguen cerrados; las
-- ocasiones las crea solo el equipo.
--
-- Compatibilidad: todo es aditivo (columnas nuevas con default, límites más altos, una RPC
-- nueva). El código desplegado antes de esta migración sigue funcionando sin cambios.

-- ============================================================
-- tags: creador, ocultar y forma normalizada única por tipo
-- ============================================================
alter table tags
  add column if not exists created_by_brand_id uuid references brands (id) on delete set null,
  add column if not exists created_by_user_id  uuid references users (id) on delete set null,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists name_key text
    generated always as (regexp_replace(public.f_unaccent(lower(name)), '[^a-z0-9]', '', 'g')) stored;

comment on column tags.name_key is
  'Nombre sin mayúsculas, acentos, espacios ni signos: "Old Money", "old-money" y "oldmoney" chocan.';

create unique index if not exists tags_type_name_key_idx on tags (type, name_key);

-- ============================================================
-- Lista de bloqueo (FR-005). Solo el equipo la ve y la edita.
-- ============================================================
create table if not exists tag_blocklist (
  word text primary key check (word = lower(word) and length(word) between 2 and 40)
);
alter table tag_blocklist enable row level security;
create policy tag_blocklist_staff_all on tag_blocklist
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select, insert, update, delete on tag_blocklist to authenticated;
grant all on tag_blocklist to service_role;

-- ============================================================
-- Límites nuevos (FR-008): prenda 6 estilos / 3 ocasiones / 3 climas / 1 categoría;
-- marca 10 estilos.
-- ============================================================
create or replace function public.check_garment_tag()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t tag_type := (select type from tags where id = new.tag_id);
  lim int := case t when 'category' then 1 when 'style' then 6 else 3 end;
begin
  if (select count(*) from garment_tags gt join tags x on x.id = gt.tag_id
      where gt.garment_id = new.garment_id and x.type = t and gt.tag_id <> new.tag_id) >= lim then
    raise exception 'La prenda ya tiene el máximo de etiquetas de tipo % (%).', t, lim
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

create or replace function public.check_brand_tag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select type from tags where id = new.tag_id) <> 'style' then
    raise exception 'Una marca solo puede tener etiquetas de estilo.' using errcode = 'check_violation';
  end if;
  if (select count(*) from brand_tags where brand_id = new.brand_id and tag_id <> new.tag_id) >= 10 then
    raise exception 'Una marca puede tener como máximo 10 estilos.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

-- ============================================================
-- Validación de nombres nuevos (estilos y colores comparten reglas)
-- ============================================================
create or replace function public.vocab_name_error(p_name text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 30
      then 'El nombre debe tener entre 2 y 30 caracteres.'
    when btrim(p_name) !~ '^[[:alnum:]áéíóúüñÁÉÍÓÚÜÑ][[:alnum:]áéíóúüñÁÉÍÓÚÜÑ \-]*$'
      then 'Usa solo letras, números, espacios y guiones.'
    when exists (
      select 1 from tag_blocklist w
      where public.f_unaccent(lower(p_name)) ~ ('(^|[^a-z0-9])' || w.word || '([^a-z0-9]|$)')
    ) then 'Ese nombre no está permitido.'
    when exists (
      select 1 from brands b
      where regexp_replace(public.f_unaccent(lower(b.name)), '[^a-z0-9]', '', 'g')
          = regexp_replace(public.f_unaccent(lower(p_name)), '[^a-z0-9]', '', 'g')
    ) then 'El nombre de una marca no puede ser un estilo.'
  end
$$;

-- Slug libre a partir del nombre ("Old money" -> "old-money"; con sufijo si ya existe).
create or replace function public.vocab_slug(p_name text, p_taken text[])
returns text language plpgsql immutable as $$
declare
  base text := coalesce(nullif(regexp_replace(regexp_replace(public.f_unaccent(lower(btrim(p_name))),
    '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'), ''), 'estilo');
  s text := base;
  i int := 2;
begin
  while s = any(p_taken) loop
    s := base || '-' || i;
    i := i + 1;
  end loop;
  return s;
end; $$;

-- ============================================================
-- create_style_tag: crea (o devuelve) un estilo. Marcas y equipo.
-- Si ya existe uno con la misma forma normalizada, devuelve ese (FR-003).
-- ============================================================
create or replace function public.create_style_tag(p_name text)
returns setof tags
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_user_id();
  my_role text := (select role::text from users where id = me);
  my_brand uuid := (select b.id from brands b where b.owner_user_id = me order by b.created_at limit 1);
  k text := regexp_replace(public.f_unaccent(lower(coalesce(p_name, ''))), '[^a-z0-9]', '', 'g');
  existing tags;
  err text;
begin
  if me is null or not (public.is_staff() or my_brand is not null) then
    raise exception 'Solo marcas y el equipo pueden crear estilos.' using errcode = 'insufficient_privilege';
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
revoke execute on function public.vocab_name_error(text) from public, anon;
grant execute on function public.vocab_name_error(text) to authenticated;
