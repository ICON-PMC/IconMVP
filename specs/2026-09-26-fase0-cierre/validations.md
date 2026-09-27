# Validations — Cierre de la Fase 0

Leyenda: **[build]** = `tsc`/`lint`/`build`; **[db]** = probado con SQL en Supabase local;
**[local]** = probado contra `next start` + Supabase local; **[nube]** = pendiente en producción.

## Links
- [x] `normalizeUrl` corrige `tienda.com`, `https://https://tienda.com`, `https//tienda.com`,
      `https:tienda.com`; respeta `http://`; no rompe `httpbin.org`; rechaza `hola`. **[local]**
- [x] `normalizeInstagramHandle` saca el usuario de `@marca`, URLs con `?hl=es` y URLs duplicadas. **[local]**
- [x] El SQL de limpieza convierte `https://www.instagram.com/lauqe_apparel/` en `lauqe_apparel`. **[db]**
- [ ] Migración `20260926000000_normalize_brand_instagram.sql` aplicada en la nube. **[nube]**
      El MCP de Supabase de la sesión es de solo lectura: pegar el SQL en el SQL Editor.

## 404
- [x] `/marca/no-existe`, `/prenda/<uuid>`, `/prenda/abc`, `/post/<uuid>` y una ruta inexistente
      responden 404 con su texto propio y el botón "Volver al feed". **[local]**

## Errores de auth
- [x] Códigos reales de Supabase local mapeados: `invalid_credentials`, `weak_password`,
      `validation_failed` (correo inválido), `user_already_exists`. **[local]**
- [x] `/login` muestra `error` (coral) y `aviso` (forest). **[local]**

## Cuota
- [x] `supabase db reset` aplica las migraciones sin errores. **[db]**
- [x] `brand_storage_bytes` suma imágenes de prendas + posts + portada (7500 esperado = 7500). **[db]**
- [x] `check_storage_quota`: la marca dueña recibe `allowed` true/false según el tamaño; otro
      usuario recibe `not allowed`; `brand_storage_bytes` no es ejecutable por `authenticated`. **[db]**
- [x] `tsc`, `lint` y `next build` limpios. **[build]**
- [ ] Migración `20260926010000_storage_quota.sql` aplicada en la nube **antes** de mergear a `main`. **[nube]**
- [ ] `npm run db:backfill-image-bytes` corrido contra la nube después de la migración. **[nube]**
- [ ] Subir una prenda desde el panel en producción guarda `bytes > 0` y la barra del Resumen cambia. **[nube]**

## Instagram
- [x] `tsc`/`lint` limpios; la lógica de renovación solo corre con < 7 días de vida del token. **[build]**
- [ ] Probar "Reconectar Instagram" con una cuenta real (forzar `token_expires_at` al pasado). **[nube]**
