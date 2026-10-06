-- GRANT SELECT que faltaba en las tablas sociales (constitución §7.2: RLS + GRANT en par).
-- `20260922000000_user_social_actions.sql` y `20260924000000_garment_likes.sql` asumían que
-- el "grant global de init.sql" cubría el select, pero ese grant solo alcanza a las tablas
-- que existían entonces. En la nube funcionaba porque el proyecto da select por defecto a
-- tablas nuevas; en una base local recién creada (`supabase db reset`) el feed fallaba con
-- "permission denied for table post_likes". Idempotente: en la nube no cambia nada.
-- Las policies ya limitan qué filas se ven (likes: públicos para el contador; follows: los propios).

grant select on post_likes, garment_likes to anon, authenticated;
grant select on brand_follows to authenticated;
