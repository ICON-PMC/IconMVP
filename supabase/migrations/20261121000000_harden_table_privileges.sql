-- Endurecer privilegios de tablas (constitución, principio III: acceso mínimo).
--
-- Hallazgo (2026-11-16): en la nube, los privilegios por defecto del esquema `public` daban TODO
-- (insert, update, delete, truncate, references, trigger) a `anon` y `authenticated` en cada tabla
-- nueva, y también execute en cada función nueva. RLS sigue decidiendo qué filas se leen o escriben,
-- pero TRUNCATE no pasa por RLS y nada de eso hace falta. En local no ocurría (otros privilegios por
-- defecto), por eso no se veía al probar.
--
-- Qué hace:
--   1. Quita TRUNCATE, REFERENCES y TRIGGER a anon y authenticated en todas las tablas y vistas.
--   2. Quita INSERT, UPDATE y DELETE a anon en todas, salvo `outbound_clicks` (el clic saliente
--      anónimo se registra con la policy `outbound_clicks_insert`). Las escrituras de anon que hagan
--      falta pasan por funciones security definer.
--   3. Cambia los privilegios por defecto del rol `postgres` (dueño de lo que se crea desde el SQL
--      Editor y las migraciones) para que las tablas y funciones nuevas no nazcan con esos permisos.
--      Desde aquí, toda tabla o función nueva necesita su GRANT explícito (como ya pide la convención).
--
-- No toca SELECT (las lecturas públicas siguen controladas por RLS) ni los permisos de authenticated
-- para insert/update/delete (la app los usa y RLS los acota), ni a service_role.
-- Idempotente: se puede ejecutar varias veces.

do $$
declare
  r record;
begin
  for r in
    select c.relname, c.relkind
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'p', 'v', 'm')
  loop
    if r.relkind in ('r', 'p') then
      execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', r.relname);
    else
      execute format('revoke references, trigger on public.%I from anon, authenticated', r.relname);
    end if;
    if r.relname <> 'outbound_clicks' then
      execute format('revoke insert, update, delete on public.%I from anon', r.relname);
    end if;
  end loop;
end $$;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from anon;
-- Funciones nuevas: sin execute para anon por defecto (una security definer olvidada no queda
-- expuesta). Las que anon deba llamar llevan `grant execute ... to anon` explícito.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
