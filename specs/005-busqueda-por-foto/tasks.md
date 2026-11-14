---
description: "Tareas de implementación de 005-busqueda-por-foto (v1 con recorte manual)"
---

# Tasks: Búsqueda por foto

**Input**: `specs/005-busqueda-por-foto/` (plan.md, spec.md, research.md, data-model.md, contracts/interfaces.md, quickstart.md)

**Tests**: el spec no pide tests automatizados (constitución: TODO(TESTS)). La validación es el set de
referencia (`visual:eval`) y los escenarios de `quickstart.md`.

**Alcance v1**: recorte manual para fotos con varias prendas (sin detección automática, decisión
2026-11-14). Costo USD 0: FashionCLIP (MIT) en ONNX con onnxruntime WASM dentro de Vercel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia del spec (US1…US5)

---

## Phase 1: Setup

- [ ] T001 Verificar la licencia MIT del ONNX cuantizado de `ff13/fashion-clip` (y del original `patrickjohncyh/fashion-clip`); si no está clara, exportar y cuantizar nosotros el encoder de imagen desde el original y documentar el resultado en `specs/005-busqueda-por-foto/research.md` (R1)
- [ ] T002 Subir el encoder de imagen cuantizado a R2 en `models/fashion-clip-vit-b32-q8.onnx` y anotar URL, tamaño y sha256 en `specs/005-busqueda-por-foto/research.md`
- [ ] T003 Agregar la dependencia `onnxruntime-web` en `package.json` y declarar `VISUAL_MODEL_URL`, `CRON_SECRET` y `PHOTO_SEARCH_MONTHLY_CAP` en `.env.example`
- [ ] T004 [P] Crear `specs/005-busqueda-por-foto/referencia/` con 30 fotos (10 de prendas del catálogo fotografiadas de nuevo, 20 de inspiración externa) y `esperado.json` con `{archivo, categoria, garmentId?}` por foto

---

## Phase 2: Foundational (bloquea todas las historias)

- [ ] T005 Escribir la migración `supabase/migrations/20261115000000_photo_search.sql`: `create extension if not exists vector with schema extensions`; tabla `garment_embeddings` (`garment_id` uuid PK → `garments(id)` on delete cascade; `embedding extensions.vector(512)` null; `image_key text not null`; `model text not null default 'fashion-clip-vit-b32-q8'`; `status text check in ('pending','ready','failed')`; `error text null`; `attempts int default 0`; `updated_at timestamptz default now()`), índice HNSW `vector_cosine_ops` parcial `where status = 'ready'`; tabla `photo_searches` (`id`, `kind text check in ('photo','similar')`, `requester_key text not null`, `user_id uuid null → users(id) on delete set null`, `detected_category text null`, `top_similarity real null`, `results int not null`, `below_threshold boolean not null`, `source_garment_id uuid null`, `created_at timestamptz default now()`, índice (`requester_key`, `created_at`)); RLS + GRANT en par según `data-model.md`; valores nuevos `photo_search` y `similar` en el enum `click_source`
- [ ] T006 En la misma migración, RPC `search_by_embedding(...)` (solo `service_role`) y `photo_search_quota(p_requester text)` según `contracts/interfaces.md`, filtrando prendas publicadas de marcas activas y aplicando los filtros como `get_feed`
- [ ] T007 Aplicar la migración en local (`supabase migration up`) y probarla con una prenda y un vector de prueba dentro de una transacción
- [ ] T008 Actualizar `src/lib/database.types.ts` con las tablas, el enum `click_source` y las RPC nuevas (mismo commit que la migración)
- [ ] T009 [P] Implementar `src/lib/visual/model.ts`: descarga lazy del ONNX desde `VISUAL_MODEL_URL` a `/tmp` (verificando sha256), sesión `onnxruntime-web` con backend WASM, singleton por instancia
- [ ] T010 [P] Implementar `src/lib/visual/embed.ts`: `embedImage(buffer)` → `Float32Array(512)` normalizado; `sharp` con `await import("sharp")` (nunca a nivel de módulo, principio V): resize/crop centrado a 224×224, RGB, normalización CLIP (media/desviación de OpenAI CLIP)
- [ ] T011 Implementar `src/lib/visual/index-garments.ts`: `processPending(supabase, {limit, garmentIds?})` que lee la imagen 0 de cada prenda desde R2 vía `imageUrl()`, calcula el vector y guarda `ready`/`failed` (+`attempts`, `error`); deja de reintentar sola tras 5 intentos
- [ ] T012 Crear `scripts/embed-catalog.ts` y el script `db:embed` en `package.json` (marca todas las publicadas como `pending` si no tienen fila y llama a `processPending` en tandas; lee `.env.local`, admite la URL/service role de la nube por variables como los demás scripts)
- [ ] T013 Crear `scripts/build-visual-prompts.ts` (solo local, usa el encoder de texto de FashionCLIP) que genera `src/lib/visual/prompts.json` con un vector por categoría de Icon (`tags` tipo `category`) y frases de contenido no permitido
- [ ] T014 Implementar `src/lib/visual/classify.ts`: `detectCategory(vec, neighbors)` (frase más parecida confirmada por voto de los 10 vecinos) y `isBlocked(vec)` con umbral `BLOCK_MIN`
- [ ] T015 Crear `scripts/visual-eval.ts` (`npm run visual:eval`): corre el set de `referencia/` contra la base, reporta top-1/top-6 (SC-001) y sugiere `SIMILAR_MIN` y `BLOCK_MIN`; guardar los umbrales elegidos en `src/lib/visual/thresholds.ts`

**Checkpoint**: catálogo local indexado con `db:embed` y `visual:eval` ≥ SC-001; si no se alcanza, evaluar Marqo-FashionSigLIP (research R1) antes de seguir.

---

## Phase 3: User Story 1 — Tomar o subir una foto y ver similares (P1) 🎯 MVP

**Goal**: desde `/feed`, cámara o galería → prendas parecidas en < 5 s.

**Independent Test**: escenario 1, 4, 5 y 10 de `quickstart.md`.

- [ ] T016 [US1] Crear `src/app/api/visual/search/route.ts` (POST, runtime Node, `maxDuration` 30): valida tipo y ≤ 2 MB (400), límite 30/hora con `photo_search_quota` sobre `requester_key` = SHA-256(IP + sal diaria) o `user:<id>` (429), tope mensual `PHOTO_SEARCH_MONTHLY_CAP` (503), `embedImage`, `isBlocked` (422 con mensaje neutro), `search_by_embedding` con `p_prefer_category`, arma filas de `feed_items`, registra en `photo_searches` sin la imagen; acepta también `{embedding}` en JSON para re-buscar. Nunca escribe la imagen a disco ni a R2 (FR-012)
- [ ] T017 [P] [US1] Crear `src/app/api/visual/warmup/route.ts` (GET → carga el modelo, 204)
- [ ] T018 [P] [US1] Crear `src/components/visual/camera-button.tsx`: ícono de cámara en el buscador; hoja con "Tomar foto" (`<input type="file" accept="image/*" capture="environment">`) y "Elegir de la galería" en móvil, arrastrar/soltar en escritorio; llama a `/api/visual/warmup` al abrir; reduce a 512 px en `<canvas>` (convierte HEIC, quita EXIF) y envía JPEG; guarda vector + miniatura en `sessionStorage` y navega a `/feed?visual=1`; si falta permiso de cámara ofrece la galería
- [ ] T019 [US1] Montar `CameraButton` en `src/components/feed/top-bar.tsx`
- [ ] T020 [US1] Crear `src/components/visual/visual-results.tsx`: miniatura de la foto buscada, aviso "No encontramos algo muy parecido; esto es lo más cercano" cuando `belowThreshold` (FR-007), grilla con `FeedCard` (guardar/like/ficha), estados de error de 400/422/429/503 en español
- [ ] T021 [US1] Modo `?visual=1` en `src/app/feed/page.tsx`: renderiza `VisualResults` (lee el vector de `sessionStorage` en el cliente y llama a la ruta con `{embedding}`), así recargar o volver atrás no pide subir la foto (FR-009)
- [ ] T022 [US1] Pasar la fuente de clic `photo_search` hasta `/out/[garmentId]` desde las tarjetas de resultados (FR-010) en `src/app/out/[garmentId]/route.ts` y los enlaces de `src/components/feed-card.tsx`

**Checkpoint**: MVP usable en Preview.

---

## Phase 4: User Story 2 — Elegir qué prenda buscar recortando (P1, v1 manual)

**Goal**: en una foto de outfit, recortar la prenda y volver a buscar sin subir de nuevo.

**Independent Test**: escenario 2 de `quickstart.md`.

- [ ] T023 [US2] Guardar en `sessionStorage` la foto reducida (data URL ≤ 512 px) junto al vector en `src/components/visual/camera-button.tsx`, para poder recortar después (se borra al cerrar la pestaña, FR-012)
- [ ] T024 [US2] Crear `src/components/visual/crop-sheet.tsx`: recuadro ajustable (táctil y mouse) sobre la miniatura; "Buscar esta parte" recorta en `<canvas>`, envía el recorte a `/api/visual/search` y reemplaza vector y miniatura
- [ ] T025 [US2] Botón "Recortar" en `src/components/visual/visual-results.tsx` y mensaje "No encontramos ropa en la foto. Prueba con otra o recórtala." para el 422 (US2 AS4)

---

## Phase 5: User Story 3 — Filtrar los resultados de la foto (P2)

**Goal**: filtros del feed sobre los resultados, sin perder el orden por parecido.

**Independent Test**: escenario 3 de `quickstart.md`.

- [ ] T026 [US3] Mostrar `FeedTopBar`/`FeedActiveChips` con los grupos aplicables a prendas (ciudad, precio, categoría, estilo, ocasión, color) en el modo `?visual=1` de `src/app/feed/page.tsx`, y reenviar los filtros de la URL a `/api/visual/search` junto con `{embedding}` (se mantienen al recortar, FR-008)
- [ ] T027 [US3] Estado vacío con "Quitar filtros" cuando los filtros dejan cero resultados en `src/components/visual/visual-results.tsx`

---

## Phase 6: User Story 4 — "Más como esta" en la ficha (P2)

**Goal**: hasta 8 prendas parecidas en `/prenda/[id]`.

**Independent Test**: escenario 7 de `quickstart.md`.

- [ ] T028 [US4] Migración `supabase/migrations/20261115010000_similar_garments.sql`: RPC `similar_garments(p_garment_id uuid, p_limit int default 8, p_min real)` (sin la propia, máximo 2 por marca, solo publicadas, `anon, authenticated`) + tipos en `src/lib/database.types.ts`
- [ ] T029 [P] [US4] Sección "Más como esta" en `src/app/prenda/[id]/page.tsx` con `FeedCard`; oculta si no hay resultados sobre `SIMILAR_MIN`; registra `kind = 'similar'` en `photo_searches`
- [ ] T030 [US4] Modo `?similar=<id>` en `src/app/feed/page.tsx` (lista completa con filtros) y fuente de clic `similar`

---

## Phase 7: User Story 5 — Catálogo siempre buscable (P2)

**Goal**: prendas nuevas buscables en ≤ 5 min; despublicadas fuera de inmediato.

**Independent Test**: escenarios 8 y 9 de `quickstart.md`.

- [ ] T031 [US5] Migración `supabase/migrations/20261115020000_embedding_triggers.sql`: trigger en `garment_images` (insert/update/delete con `position = 0`) y en `garments` (pasa a `published`) que hacen upsert `pending` con la nueva `image_key`
- [ ] T032 [US5] Llamar a `processPending({garmentIds})` con `after()` en las acciones que publican o cambian la foto: `src/app/marca/panel/actions.ts`, `src/app/admin/actions.ts`, `src/app/admin/bulk/actions.ts`, `src/app/onboarding/marca/actions.ts` (al aprobar marca: `src/app/admin/review-actions.tsx` o la acción que llama `approve_brand`)
- [ ] T033 [US5] Crear `src/app/api/embeddings/process/route.ts` (Bearer `CRON_SECRET` o sesión staff; ≤ 25 por llamada; borra `photo_searches` > 180 días) y el cron en `vercel.json`
- [ ] T034 [US5] En `/admin` (`src/app/admin/page.tsx` + componente nuevo en `src/app/admin/_components/visual-index.tsx`): % de prendas publicadas buscables, lista de fallidas con error y botón "Reintentar" (FR-018)

---

## Phase 8: Polish y transversal

- [ ] T035 Métricas semanales en `/admin` (FR-020): búsquedas por foto, % con resultados "muy parecidos", clics salientes desde `photo_search` y `similar`, en `src/app/admin/_components/visual-index.tsx`
- [ ] T036 [P] Texto de privacidad: mencionar que la foto se usa solo para la búsqueda, no se guarda y se procesa en nuestros servidores (FR-013), en la página o pie de privacidad existente
- [ ] T037 Revisar diseño móvil 375 px de la hoja de cámara, el recorte y los resultados con los tokens glass/tropical (principio VI)
- [ ] T038 Aplicar las migraciones en Supabase cloud (SQL Editor) en orden, correr `npm run db:embed` contra la nube y verificar con `visual:eval`
- [ ] T039 Configurar `VISUAL_MODEL_URL`, `CRON_SECRET`, `PHOTO_SEARCH_MONTHLY_CAP` en Vercel (Preview y Production)
- [ ] T040 `npm run lint` + `npm run build`; validar todos los escenarios de `quickstart.md` en Preview y medir arranque en frío/inferencia en los logs de Vercel (SC-002); registrar resultados en el PR

---

## Dependencies & Execution Order

- **Setup (T001–T004)** → **Foundational (T005–T015)** → historias.
- **US1** depende solo de Foundational. **US2** depende de US1 (reusa la hoja y la ruta). **US3** depende de US1. **US4** depende de Foundational (independiente de US1). **US5** depende de Foundational.
- Las migraciones (T005/T006, T028, T031) se aplican en la nube **antes** de mergear el código que las usa (principio IV).
- Polish al final; T038–T040 antes del merge a `dev`.

### Parallel Opportunities

- T004 en paralelo con T001–T003.
- T009 y T010 en paralelo (archivos distintos); T013 en paralelo con T011–T012.
- En US1: T017 y T018 en paralelo con T016.
- US4 (T028–T030) y US5 (T031–T034) en paralelo con US2/US3 una vez terminado US1… o incluso antes, porque no dependen de él.

## Implementation Strategy

1. **MVP** = Setup + Foundational + US1 → probar en Preview (búsqueda por foto completa).
2. + US2 (recorte) → cubre las fotos de outfit, completa las historias P1.
3. + US5 (indexación automática) para que el catálogo no se desactualice.
4. + US3 y US4 → filtros y "Más como esta".
5. Polish y medición.

**Total**: 40 tareas — Setup 4 · Foundational 11 · US1 7 · US2 3 · US3 2 · US4 3 · US5 4 · Polish 6.
