-- Usos de cada etiqueta para /admin?tab=etiquetas (spec 2026-10-06, plan 2g).
-- security definer: user_preferences solo deja leer las filas propias, así que sin esto el
-- staff vería 0 usos en estilos que eligieron los usuarios y podría borrarlos (el cascade los
-- quitaría de sus preferencias en silencio). Solo staff.

create or replace function public.tag_usage_counts()
returns table (tag_id uuid, uses integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo puede ver el uso de las etiquetas.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select t.id, (
      (select count(*) from garment_tags x where x.tag_id = t.id) +
      (select count(*) from post_tags x where x.tag_id = t.id) +
      (select count(*) from brand_tags x where x.tag_id = t.id) +
      (select count(*) from user_preferences x where x.tag_id = t.id)
    )::int
    from tags t;
end; $$;

revoke execute on function public.tag_usage_counts() from public, anon;
grant execute on function public.tag_usage_counts() to authenticated;
