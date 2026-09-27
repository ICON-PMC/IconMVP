# TODO — cierre de la Fase 0

**Dónde estamos (2026-09-26):** el piloto ya corrió con marcas reales que cargaron su propio
contenido, y la usabilidad se probó con el equipo. La Fase 0 está cerrada en código
(`specs/roadmap.md`); esta lista es lo que falta para dejarla redonda en producción y lo que
quedó anotado para después. El plan por fases vive en `specs/roadmap.md`.

Marcado `[ ]` pendiente, `[x]` hecho. Cuando termines algo, muévelo a "Hecho" con la fecha.

## Para cerrar el release (en este orden)

- [ ] **Aplicar las migraciones nuevas en la nube** (SQL Editor del proyecto `oyzvuckkxzbufncvzcvw`),
      en orden y **antes** de mergear `dev` → `main`:
      1. `supabase/migrations/20260926000000_normalize_brand_instagram.sql` — limpia los usuarios de
         Instagram guardados como URL (hoy afecta a 1 marca).
      2. `supabase/migrations/20260926010000_storage_quota.sql` — columnas de peso + `check_storage_quota`.
         **Sin esta migración, subir imágenes en producción falla** (el código ya escribe `bytes`).
- [ ] **Rellenar el peso de las imágenes existentes:** `npm run db:backfill-image-bytes` con las
      variables de la nube (ver HANDOFF, "Para apuntar un script a la nube").
- [ ] **Release:** merge `dev` → `main` y smoke test en producción: `/marca/<slug>` con Instagram,
      una ruta 404, login con contraseña incorrecta, subir una prenda desde el panel de marca
      (la barra de almacenamiento del Resumen debe moverse).
- [ ] **Confirmar el ajuste de "Confirm email"** en Supabase Auth. El registro ahora maneja los dos
      casos (con confirmación muestra "Te enviamos un correo…"), pero conviene saber cuál está activo.
- [ ] **Probar "Reconectar Instagram"** con una cuenta real: poner `token_expires_at` en el pasado
      para una marca de prueba y verificar el aviso en el panel y en `/marca/panel/import`.

## Anotado para después (no bloquea)

- [ ] **Token de Instagram fuera del alcance del cliente.** La policy de
      `brand_instagram_connections` deja que la marca dueña lea su propio `access_token` con el
      cliente de Supabase. No expone tokens de otras marcas, pero el roadmap pide "solo
      server-side": mover la lectura del token a `service_role` y quitar el `select` de esa
      columna a `authenticated`.
- [ ] **Meta App Review:** confirmar el estado de la revisión de permisos de Instagram si se van a
      sumar marcas que no estén como testers de la app.
- [ ] **Feedback dentro de la app** — en pausa por decisión de producto (2026-09-26).
- [ ] **Dominio propio para las imágenes.** Hoy se sirven desde `pub-*.r2.dev`, que tiene rate limit.
      También es prerrequisito del correo transaccional (Fase 2) si se usa el mismo dominio.
- [ ] **Analítica del piloto:** confirmar que `/admin` (Métricas) se entiende sin ayuda para dar
      seguimiento diario.

## Deliberadamente fuera de esta lista

Si alguien propone retomarlo antes de tiempo, esta es la razón para decir "todavía no":

- **Reseñas/UGC** — Fase 2 (`specs/roadmap.md`).
- **PWA instalable** (faltan íconos PNG 192/512 y service worker) — cosmético.
- **Búsqueda semántica** (pgvector/embeddings) — el trigram actual cubre el volumen del MVP.

## Hecho

- 2026-09-26 — **Links rotos corregidos**: Instagram guardado como URL armaba
  `instagram.com/https://…`; tienda y producto se normalizan al guardar y al renderizar
  (`src/lib/links.ts`). Spec `2026-09-26-fase0-cierre`.
- 2026-09-26 — **Páginas 404** para `/marca/[slug]`, `/prenda/[id]`, `/post/[id]` y rutas inexistentes.
- 2026-09-26 — **Errores de login/registro en español.**
- 2026-09-26 — **Cuota de 300 MB por marca** con barra de uso en el panel.
- 2026-09-26 — **Token de Instagram**: renovación al usarlo + aviso "Reconectar Instagram".
- 2026-09 — **Piloto con marcas reales**: registro propio de marcas, cola de aprobación, catálogo y
  looks cargados por las marcas; usabilidad probada por el equipo (incluido celular).
- 2026-09 — **Google OAuth activo** en la nube.
- 2026-09-22 — **Guardar, seguir marcas y like** (outfits y prendas); `/saved` con Guardados/Siguiendo.
- 2026-09-21 — **Feed mixto** outfits + prendas con scroll infinito (lotes de 24), filtros plegables,
  sugerencias y búsqueda con pestañas.
- 2026-09-21 — **Panel de marca y `/admin` rediseñados** (shadcn/ui, mobile-first).
- 2026-09-19 — **Vínculo usuario ↔ marca** (`brands.owner_user_id`), rol `brand` y RLS por marca;
  importación desde Instagram vía Instagram Login.
- 2026-09-09 — Producción verificada (`/feed` sirve contenido real) y cuentas de staff confirmadas.
