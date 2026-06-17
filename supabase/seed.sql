-- Icon — seed del vocabulario controlado (taxonomía estática del MVP).
-- Idempotente: se puede correr varias veces sin duplicar.

-- ============================================================
-- Ciudades (nicho de arranque)
-- ============================================================
insert into cities (name, slug) values
  ('Barranquilla', 'barranquilla'),
  ('Medellín',     'medellin'),
  ('Bogotá',       'bogota')
on conflict (slug) do nothing;

-- ============================================================
-- Tags — categorías (1 por prenda)
-- ============================================================
insert into tags (type, name, slug) values
  ('category', 'Vestidos',              'vestidos'),
  ('category', 'Tops',                  'tops'),
  ('category', 'Blusas',                'blusas'),
  ('category', 'Camisas',               'camisas'),
  ('category', 'Pantalones',            'pantalones'),
  ('category', 'Jeans',                 'jeans'),
  ('category', 'Shorts',                'shorts'),
  ('category', 'Faldas',                'faldas'),
  ('category', 'Enterizos y conjuntos', 'enterizos-y-conjuntos'),
  ('category', 'Chaquetas',             'chaquetas'),
  ('category', 'Abrigos y tejidos',     'abrigos-y-tejidos'),
  ('category', 'Swimwear',              'swimwear'),
  ('category', 'Calzado',               'calzado'),
  ('category', 'Bolsos',                'bolsos'),
  ('category', 'Accesorios',            'accesorios')
on conflict (type, slug) do nothing;

-- ============================================================
-- Tags — ocasiones
-- ============================================================
insert into tags (type, name, slug) values
  ('occasion', 'Casual',    'casual'),
  ('occasion', 'Trabajo',   'trabajo'),
  ('occasion', 'Fiesta',    'fiesta'),
  ('occasion', 'Formal',    'formal'),
  ('occasion', 'Beachwear', 'beachwear'),
  ('occasion', 'Brunch',    'brunch'),
  ('occasion', 'Workout',   'workout'),
  ('occasion', 'Viaje',     'viaje')
on conflict (type, slug) do nothing;

-- ============================================================
-- Tags — estilos
-- ============================================================
insert into tags (type, name, slug) values
  ('style', 'Minimalista', 'minimalista'),
  ('style', 'Boho',        'boho'),
  ('style', 'Streetwear',  'streetwear'),
  ('style', 'Clásico',     'clasico'),
  ('style', 'Tropical',    'tropical'),
  ('style', 'Vintage',     'vintage'),
  ('style', 'Artesanal',   'artesanal')
on conflict (type, slug) do nothing;

-- ============================================================
-- Tags — temperatura
-- ============================================================
insert into tags (type, name, slug) values
  ('temperature', 'Cálido',   'calido'),
  ('temperature', 'Templado', 'templado'),
  ('temperature', 'Frío',     'frio')
on conflict (type, slug) do nothing;

-- ============================================================
-- Tallas (alpha + especiales). 'numeric' se crea bajo demanda.
-- aliases sirve para normalizar entradas equivalentes (ej. 2XS -> XXS).
-- ============================================================
insert into sizes (system, label, sort_order, aliases) values
  ('alpha',   'XXXS',      10,  array['3XS']),
  ('alpha',   'XXS',       20,  array['2XS']),
  ('alpha',   'XS',        30,  '{}'),
  ('alpha',   'S',         40,  '{}'),
  ('alpha',   'M',         50,  '{}'),
  ('alpha',   'L',         60,  '{}'),
  ('alpha',   'XL',        70,  '{}'),
  ('alpha',   'XXL',       80,  array['2XL']),
  ('alpha',   'XXXL',      90,  array['3XL']),
  ('special', 'Onesize',   100, array['os','unitalla','talla unica']),
  ('special', 'Plussize',  110, array['plus','curvy'])
on conflict (label) do nothing;
