# Implementation Plan: Búsqueda por foto

**Branch**: `005-busqueda-por-foto` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-busqueda-por-foto/spec.md`

## Summary

La persona sube o toma una foto de una prenda y ve prendas parecidas del catálogo; además, cada ficha
muestra "Más como esta". Enfoque: un modelo abierto de visión especializado en moda (**FashionCLIP**,
MIT) convierte cada foto en un vector de 512 números; los vectores del catálogo viven en Postgres con
**pgvector** y se comparan por similitud coseno con los filtros del feed aplicados en la misma
consulta. El modelo corre en una función de Vercel (onnxruntime WASM), así que el costo es USD 0 y la
foto nunca sale de nuestro servidor ni se guarda. MVP de "varias prendas en la foto": recorte manual
en el cliente; la detección automática queda pendiente de decisión (research R3).

## Technical Context

**Language/Version**: TypeScript 5 / Node 22 (Vercel), SQL (Postgres 15+)

**Primary Dependencies**: Next.js 16 (App Router, route handlers, `after()`), Supabase JS,
`onnxruntime-web` (backend WASM en Node), `sharp` (ya en el proyecto, import lazy), `pgvector`

**Storage**: Supabase Postgres (`garment_embeddings`, `photo_searches`), R2 (archivo del modelo; las
fotos del catálogo ya están ahí). Fotos de personas: en memoria, nunca persistidas.

**Testing**: sin suite automatizada (constitución, TODO(TESTS)); validación con `quickstart.md`, set de
referencia de 30 fotos y script `visual:eval`.

**Target Platform**: Web móvil y escritorio (Vercel + Supabase cloud)

**Project Type**: web-app (Next.js monorepo único en `src/`)

**Performance Goals**: 90 % de búsquedas por foto con resultados en < 5 s en 4G (SC-002), incluida la
subida de ~60 KB; inferencia en instancia caliente < 1,5 s.

**Constraints**: costo ~USD 0; función de Vercel ≤ 250 MB descomprimida (modelo descargado de R2 a
`/tmp`, no empaquetado); migraciones aditivas y compatibles con `main` (base compartida); licencias
compatibles con uso comercial.

**Scale/Scope**: 236 prendas / 10 marcas hoy; diseño válido hasta ~25 000 prendas (HNSW).

## Constitution Check

*GATE: pasa antes de Phase 0 y se revalida tras el diseño.*

| Principio | Cumplimiento |
|---|---|
| I. Pilares | Refuerza *Intención* y *Local/independiente* (nombrados en el spec). ✅ |
| II. Conectar, no vender | Los resultados usan `FeedCard` → ficha → `/out/[garmentId]`; se agrega fuente de clic `photo_search`/`similar` sin degradar `outbound_clicks`. ✅ |
| III. Acceso mínimo | Tablas nuevas con RLS + GRANT en par; solo prendas publicadas de marcas activas; RPC de búsqueda solo `service_role`; métricas solo staff. ✅ |
| IV. Esquema fuente de verdad | Migración nueva aditiva, `database.types.ts` en el mismo commit, aplicada a la nube antes del merge; SQL directo vía RPC, sin ORM ni caché externa. ✅ |
| V. Imágenes por el pipeline | Las fotos del catálogo se leen desde R2 (ya pasaron por `sharp`). La foto de búsqueda no se publica ni se guarda: es un dato efímero, no un "artefacto" ni una imagen publicada; `sharp` se importa lazy. ✅ |
| VI. Sistema visual | Hoja de cámara, recorte y sección "Más como esta" con tokens glass/tropical y `GlassCard`; móvil primero. ✅ |
| VII. Español inclusivo | Textos en español neutro. ✅ |
| VIII. Alcance | **Requiere la enmienda 1.2.0** (incluida en esta rama): saca la similitud visual de las exclusiones; la búsqueda semántica de texto sigue fuera. ✅ tras aprobar el PR de la enmienda. |
| Gobierno: complejidad | Nuevas piezas: extensión `pgvector`, dependencia `onnxruntime-web`, 2 tablas, 1 cron. Justificadas por *Intención* (ver Complexity Tracking). |

**Re-check post-diseño**: sin violaciones nuevas. ✅

## Project Structure

### Documentation (this feature)

```text
specs/005-busqueda-por-foto/
├── spec.md
├── plan.md              # este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/interfaces.md
├── referencia/          # set de 30 fotos + esperado.json (SC-001)
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/
└── 2026111500000x_photo_search.sql      # pgvector, garment_embeddings, photo_searches, RPC, triggers

src/lib/visual/
├── model.ts            # carga lazy del ONNX desde R2 a /tmp + sesión WASM (singleton por instancia)
├── embed.ts            # imagen → vector normalizado (sharp lazy: 224×224, normalización CLIP)
├── prompts.json        # vectores de texto precalculados (categorías + bloqueo)
├── classify.ts         # categoría detectada y filtro de contenido (comparación con prompts)
└── index-garments.ts   # procesa pendientes de garment_embeddings (usa R2 + embed)

src/app/api/visual/search/route.ts       # POST búsqueda por foto
src/app/api/visual/warmup/route.ts       # GET calentamiento
src/app/api/embeddings/process/route.ts  # cron / reintento staff

src/components/visual/
├── camera-button.tsx   # ícono en el buscador + hoja (cámara/galería/arrastre)
├── crop-sheet.tsx      # recorte manual en canvas
└── visual-results.tsx  # miniatura, aviso "lo más cercano", grilla
src/app/feed/page.tsx                    # modo ?visual=1 y ?similar=<id>
src/app/prenda/[id]/page.tsx             # sección "Más como esta"
src/app/admin/...                        # estado del índice + métricas

scripts/
├── embed-catalog.ts        # npm run db:embed (carga inicial / reindexar)
├── build-visual-prompts.ts # genera prompts.json (encoder de texto, solo en local)
└── visual-eval.ts          # npm run visual:eval (SC-001 + calibración de umbrales)

vercel.json                 # cron de /api/embeddings/process
```

**Structure Decision**: mismo proyecto Next.js en `src/`; la lógica de visión queda aislada en
`src/lib/visual/` para poder cambiar de modelo (columna `model` en `garment_embeddings`) sin tocar la UI.

## Migraciones y orden de despliegue

1. **PR de enmienda de la constitución 1.2.0** (este branch) — aprobada por la dueña antes de mergear código.
2. Migración `photo_search` aplicada en Supabase cloud (aditiva: extensión, tablas, RPC, triggers,
   valores nuevos de `click_source`). Compatible con `main`.
3. Subir el modelo a R2 y definir `VISUAL_MODEL_URL`, `CRON_SECRET`, `PHOTO_SEARCH_MONTHLY_CAP` en
   Vercel (Preview y Production; las `NEXT_PUBLIC_*` no cambian).
4. `npm run db:embed` contra la nube (236 prendas).
5. Merge del código a `dev` → verificar en Preview con `quickstart.md`.

## Decisiones pendientes de la dueña

- ~~Detección automática de varias prendas~~ → **Decidido 2026-11-14: recorte manual por ahora.**
  La detección (detector abierto o Claude Haiku) queda para una versión siguiente.
- **Plan de Vercel**: en Hobby el cron corre una vez al día; las prendas nuevas igual se indexan al
  publicarse con `after()`, el cron es solo respaldo.

## Complexity Tracking

| Pieza nueva | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Extensión `pgvector` + `garment_embeddings` | Comparar parecido visual con filtros en una consulta (FR-005/008) | Comparar en Node: duplica datos y no escala |
| Dependencia `onnxruntime-web` + modelo de 89 MB en R2 | Calcular vectores gratis y sin enviar fotos a terceros (FR-012/013, costo USD 0) | APIs externas: costo, sin créditos gratis o sin modelo de imagen |
| Tabla `photo_searches` | Límite de uso confiable en serverless + métricas (FR-014/019/020) | Límite en memoria: se pierde entre instancias |
| Vercel Cron | Respaldo de indexación y retención 180 días (FR-016, R6) | Solo `after()`: una falla dejaría prendas sin indexar |
