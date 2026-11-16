-- Estilos populares del filtro de /feed (spec 006, US3). Antes la página leía la columna `styles`
-- de TODO feed_items en cada visita para contarlos en JavaScript; ahora cuenta la base.
-- security invoker (por defecto): solo cuenta lo que quien consulta puede ver (publicado).
-- Aditiva; el código de `main` no la usa.

create or replace function public.feed_style_counts()
returns table (slug text, uses integer)
language sql stable
set search_path = public
as $$
  select s as slug, count(*)::int as uses
  from feed_items f, unnest(f.styles) as s
  group by s
  order by uses desc, s;
$$;

revoke execute on function public.feed_style_counts() from public;
grant execute on function public.feed_style_counts() to anon, authenticated, service_role;
