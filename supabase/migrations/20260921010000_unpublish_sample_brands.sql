-- Despublica las 3 marcas de muestra (Bruma, Raíz, Marea) sin borrar nada.
-- Spec: specs/2026-09-21-mixed-feed/plan.md, grupo 10.
-- Quedan en status = 'pending' con submitted_at nulo: is_active se deriva de status por
-- trigger, así que salen del feed, de la búsqueda y de la cola de aprobación (que solo
-- lista submitted_at no nulo).
--
-- Reversible: para restaurar, correr
--   update brands set status = 'active' where slug in ('bruma', 'raiz', 'marea');

update brands
set status = 'pending', submitted_at = null
where slug in ('bruma', 'raiz', 'marea');
