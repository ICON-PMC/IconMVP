-- Vocabulario ampliado de estilos y ocasiones (lista fija, decisión 1).
-- Spec: specs/2026-10-06-etiquetas-ciudades-busqueda/plan.md, 1d.
-- Propuesta pendiente de confirmar con producto: revisar antes de aplicar en la nube.
-- Idempotente; en local las del seed.sql se cargan después y no chocan.

insert into tags (type, name, slug) values
  ('style',    'Urbano',     'urbano'),
  ('style',    'Romántico',  'romantico'),
  ('style',    'Deportivo',  'deportivo'),
  ('style',    'Elegante',   'elegante'),
  ('style',    'Y2K',        'y2k'),
  ('style',    'Caribeño',   'caribeno'),
  ('style',    'Andino',     'andino'),
  ('style',    'Colorido',   'colorido'),
  ('style',    'Neutro',     'neutro'),
  ('occasion', 'Noche',      'noche'),
  ('occasion', 'Día a día',  'dia-a-dia'),
  ('occasion', 'Evento',     'evento'),
  ('occasion', 'Grado',      'grado'),
  ('occasion', 'Matrimonio', 'matrimonio')
on conflict (type, slug) do nothing;
