-- Rol de marca. Valor de enum nuevo por separado (ALTER TYPE ... ADD VALUE no puede
-- usarse en la misma transacción que otro statement que ya referencie el valor nuevo).
alter type user_role add value 'brand';
