-- Tallas numéricas.
--
-- La migración inicial decía que las tallas 'numeric' "se crean bajo demanda cuando la marca
-- escribe un número", pero ningún flujo lo implementó: el panel de marca, /admin y /admin/bulk
-- solo LISTAN las tallas que ya existen. Resultado: tallas de uso común en Colombia (jeans 4–14,
-- cintura 28–32) no se podían elegir en el panel y el importador masivo las omitía.
--
-- Se siembra un conjunto curado y acotado (no cualquier número) para no ensuciar el vocabulario:
--   · 2–18 (pares): tallaje numérico colombiano de ropa de mujer
--   · 24–36 (pares): cintura de jeans
-- Idempotente: `label` es único, lo que ya exista (p. ej. 28, 30, 32) se respeta tal cual.
-- sort_order = 200 + n deja las numéricas después de las de letras (10–110) y en orden numérico.
insert into sizes (system, label, sort_order, aliases)
select 'numeric'::size_system, n::text, 200 + n, '{}'::text[]
from unnest(array[2, 4, 6, 8, 10, 12, 14, 16, 18, 24, 26, 28, 30, 32, 34, 36]) as n
on conflict (label) do nothing;
