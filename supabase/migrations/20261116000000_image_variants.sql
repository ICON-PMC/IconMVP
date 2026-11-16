-- Variantes de imagen (spec 006-rendimiento, constitución 2.0.0 principio V).
-- Cada foto publicada existe en 1280 px (principal, la clave que guarda la base) y en dos variantes
-- más pequeñas nombradas por convención: `{dir}/{nombre}.w320.webp` y `{dir}/{nombre}.w640.webp`.
-- Estas columnas solo indican qué falta generar; la interfaz arma el srcset por convención y, si una
-- variante falta, vuelve a la principal. Las variantes no cuentan para la cuota (`bytes` no cambia).
--
-- Aditiva y compatible con `main`: el código en producción no lee estas columnas y el valor por
-- defecto cubre sus inserciones. No toca vistas, funciones, policies ni GRANT.

alter table public.garment_images add column if not exists variants_ready boolean not null default false;
alter table public.post_images    add column if not exists variants_ready boolean not null default false;
alter table public.brands         add column if not exists logo_variants_ready boolean not null default false;

create index if not exists garment_images_variants_pending_idx on public.garment_images (id) where variants_ready = false;
create index if not exists post_images_variants_pending_idx    on public.post_images (id)    where variants_ready = false;
create index if not exists brands_logo_variants_pending_idx    on public.brands (id)
  where logo_variants_ready = false and logo_url is not null;

-- Valores que no son claves de R2 (URLs http de datos de muestra) o vacíos: nada que generar.
update public.garment_images set variants_ready = true where cf_image_id ~ '^https?://';
update public.post_images    set variants_ready = true where cf_image_id ~ '^https?://';
update public.brands         set logo_variants_ready = true where logo_url is null or logo_url ~ '^https?://';
