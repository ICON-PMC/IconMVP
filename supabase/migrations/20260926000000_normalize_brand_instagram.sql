-- Limpia brands.instagram: algunas marcas guardaron la URL completa ("https://www.instagram.com/marca/")
-- o "@marca" en vez del usuario, y /marca/[slug] armaba "https://instagram.com/https://...".
-- Desde este cambio la app guarda solo el usuario (src/lib/links.ts). Idempotente.

update public.brands
set instagram = nullif(
  regexp_replace(                                    -- 3. quita "@" inicial
    regexp_replace(                                  -- 2. corta en "/", "?" o "#"
      regexp_replace(instagram, '^.*instagram\.com/', '', 'i'),  -- 1. hasta el último instagram.com/
      '[/?#].*$', ''),
    '^@+', ''),
  '')
where instagram ~* '(instagram\.com/|^@|[/?#])';
