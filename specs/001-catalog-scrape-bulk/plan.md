# Implementation Plan: Importar catálogo de una marca desde el panel de carga masiva

**Branch**: `001-catalog-scrape-bulk` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-catalog-scrape-bulk/spec.md`

## Summary

Llevar al panel `/admin/bulk` lo que hoy hace `scripts/catalog-to-excel.ts`, y cerrar el ciclo
"leer tienda → revisar Excel → subir Excel + fotos → detectar descontinuadas".

Enfoque técnico (detalle y alternativas en [research.md](./research.md)):

1. **Extraer** la lógica del script a una librería compartida (`src/lib/catalog/`) sin dependencias de
   Next; el CLI pasa a ser una capa fina sobre ella (sigue disponible, según los supuestos del spec).
2. **Corridas por tandas guiadas desde el navegador.** Cada tanda es una server action acotada
   (~40 s) que avanza una *corrida* guardada en Postgres; el cliente repite hasta terminar. Esto
   resuelve el límite de duración de Vercel, da progreso real y hace la reanudación gratis (FR-009).
3. **Almacén temporal en R2** (prefijo `catalog-runs/<id>/`) para las fotos originales y el Excel
   generado; **ZIP en streaming** (`fflate`) en un route handler para la descarga del paquete (FR-017).
4. **Subida conjunta orquestada por el cliente:** una server action crea las prendas desde el Excel
   (con deduplicación y mapa `foto → prenda`), y luego el cliente sube cada foto de la carpeta con la
   acción de foto ya existente, 3 en paralelo, con cuota estricta (FR-010, FR-012).
5. **Comparación de catálogo** al cerrar una lectura en vivo completa: migración con
   `garments.last_seen_at` y `garments.discontinued_at`; el staff archiva lo que ya no aparece
   (FR-020 a FR-024).

## Technical Context

**Language/Version**: TypeScript 5, Node 20+ (runtime Node de Vercel), React 19.2

**Primary Dependencies**: Next.js 16.2.9 (App Router, server actions), `@supabase/ssr` + `supabase-js`,
`exceljs` (ya instalado), `aws4fetch` (ya instalado, R2), `sharp` (ya instalado, solo en la subida final),
shadcn/ui + `sonner` + `lucide-react` (ya instalados). **Nueva**: `fflate` (ZIP en streaming, JS puro,
sin binarios nativos).

**Storage**: Postgres (Supabase): tabla nueva `catalog_runs`, columnas nuevas `garments.last_seen_at` y
`garments.discontinued_at`. Cloudflare R2: prefijo temporal `catalog-runs/<runId>/` (fotos originales,
`catalogo.xlsx`, `origen.json`), con TTL de 7 días.

**Testing**: el repo no tiene suite automatizada (`TODO(TESTS)` de la constitución). Verificación =
`npm run lint` + `npm run build` + escenarios de [quickstart.md](./quickstart.md), incluida una
regresión del CLI refactorizado (mismo Excel que antes para la misma entrada).

**Target Platform**: Vercel (funciones serverless Node, sin disco persistente) + Supabase cloud.

**Project Type**: aplicación web (Next.js full-stack); sin backend separado.

**Performance Goals**: catálogo de 100 prendas completo (lectura + fotos + Excel) en menos de 5 min de
reloj, sin intervención; cada tanda de servidor ≤ 40 s; descarga del paquete sin límite de tamaño de
respuesta gracias al streaming.

**Constraints**: sin disco persistente; respuesta no-streaming ≤ 4.5 MB; `serverActions.bodySizeLimit`
10 MB por acción; `maxDuration = 60` en la ruta; peticiones a la tienda con pausa (≥ 1 s entre páginas,
300 ms entre fotos), `robots.txt` y User-Agent identificado; `sharp` solo lazy; `Blob` para subir a R2.

**Scale/Scope**: 10 marcas / 100 usuarios; catálogos típicos ≤ 150 prendas, tope duro de 500 por
corrida; uso exclusivo de staff (pocas corridas por semana).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|---|---|---|
| I. Tres pilares | Refuerza **curaduría** (más catálogo real, revisado por una persona antes de crear) y **local/independiente** (alta ágil de marcas con consentimiento). Declarado en el spec. | ✅ |
| II. Conectar, no vender | No toca pagos. La detección de descontinuadas reduce clics salientes a prendas agotadas. `/out/[garmentId]` y `outbound_clicks` no cambian. | ✅ |
| III. Acceso mínimo (NON-NEGOTIABLE) | `catalog_runs` nace con RLS + GRANT explícitos, solo `is_staff()`, sin acceso `anon`. Todas las acciones y el route handler llaman `requireStaff()`. No se usa `service_role` en la app. Archivar solo con decisión del staff. | ✅ |
| IV. Esquema como fuente de verdad | Migración nueva (no se edita ninguna aplicada); `database.types.ts` a mano en el mismo commit; **migración a la nube antes del código**. Sin ORM. Lectura del catálogo propio por tablas/RPC existentes. | ✅ |
| V. Imágenes solo por el pipeline | Las fotos **definitivas** siguen yendo por `uploadImageField` (sharp lazy → WebP 1280/80 → `uploadToR2` con `Blob`) y cuota, **incluida la subida de fotos sueltas de `/admin/bulk`** (`strict_quota`). El almacén temporal `catalog-runs/` cumple la cláusula de *artefactos temporales* añadida en la constitución v1.1.0: no se sirve al público, TTL 7 días con purga, fuera de cuota, y la imagen publicada pasa por el pipeline. | ✅ |
| VI. Un solo sistema visual | UI con shadcn y tokens de `globals.css`; sin colores nuevos. Responsive en móvil. | ✅ |
| VII. Español inclusivo | Todo texto de UI, errores y `origen.json` en español neutro. | ✅ |
| VIII. Alcance disciplinado | Fuera: otras plataformas, precios/stock, importación directa. Una dependencia nueva (`fflate`) justificada en research. | ✅ |

**Gate**: pasa. La excepción del almacén temporal se formalizó como cláusula de la constitución v1.1.0
(2026-10-30) a raíz de `/speckit-analyze` (hallazgo C1); ya no es una excepción puntual del plan.

**Re-evaluación post-diseño (Phase 1)**: sin cambios; el diseño añade dos columnas y una tabla, todas
cubiertas por III y IV. Tras el análisis se corrigió además que el cargador de fotos sueltas también
respete la cuota (principio V).

## Project Structure

### Documentation (this feature)

```text
specs/001-catalog-scrape-bulk/
├── plan.md              # Este archivo
├── research.md          # Decisiones y alternativas
├── data-model.md        # Tablas, columnas, estados, forma del JSON de comparación
├── quickstart.md        # Guía de validación de extremo a extremo
├── contracts/
│   ├── server-actions.md    # Firmas y resultados de las acciones + route handler
│   └── package-format.md    # Paquete .zip, columnas del Excel y hoja oculta de origen
├── checklists/requirements.md
└── tasks.md             # Lo genera /speckit-tasks (no este comando)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20261030000000_catalog_runs.sql          # catalog_runs + last_seen_at + discontinued_at + trigger

src/lib/
├── database.types.ts                         # + catalog_runs, + columnas de garments (a mano)
├── r2.ts                                     # + getFromR2 (GET firmado)
└── catalog/                                  # NUEVO · puro TS, imports relativos, sin next/*
    ├── http.ts           # politeFetch, robots.txt, BloqueadoError, User-Agent
    ├── shopify.ts        # tipos Product, fromShopifyJson, fetchProductsPage, parseCsv/fromCsv
    ├── infer.ts          # norm, slug, htmlToText, inferCategory, matchTags, normalizeSizes
    ├── vocabulary.ts     # Vocabulary, FALLBACK, carga por REST (CLI) y por supabase-js (servidor)
    ├── workbook.ts       # buildWorkbook(): hoja Prendas, Referencia, validaciones, hoja Origen oculta
    └── product-key.ts    # productKey(url): clave estable /products/<handle> para dedupe y comparación

src/lib/catalog-runs.ts                       # servidor: crear/avanzar/descartar corridas, comparar, purgar

scripts/
└── catalog-to-excel.ts                       # CLI delgado sobre src/lib/catalog (mismo comportamiento)

src/app/admin/bulk/
├── page.tsx                                  # + maxDuration, + sección "Leer tienda", + historial
├── actions.ts                                # importGarments: dedupe, mapa foto→prenda, vínculo a corrida;
│                                             #   uploadGarmentImageAction: cuota estricta opcional
├── import-form.tsx → import-package-form.tsx # Excel + carpeta de fotos en una acción (cliente orquesta)
├── photo-matching.ts                         # emparejado puro foto↔prenda por nombre de archivo
├── pending-garments.tsx                      # se mantiene (prendas sin foto); ahora con strict_quota=1
└── catalog/
    ├── actions.ts                            # startCatalogRun, advanceCatalogRun, discardCatalogRun,
    │                                         #   archiveMissingAction, republishReappearedAction
    ├── catalog-panel.tsx                     # contenedor: formulario + avance + corridas retomables
    ├── format.ts                             # formatWhen (misma salida en servidor y navegador)
    ├── run-form.tsx                          # marca, fuente (URL/CSV), consentimiento, opciones
    ├── run-progress.tsx                      # bucle de tandas, barra de avance, reanudar/descartar
    ├── comparison-panel.tsx                  # siguen / nuevas / ya no aparecen / reaparecen
    ├── runs-list.tsx                         # historial + corridas retomables
    └── [runId]/paquete/route.ts              # GET: ZIP en streaming (xlsx + fotos + origen.json)

.env.example                                  # + CATALOG_BOT_CONTACT
docs/importar-catalogo.md                     # + sección "Desde el panel"
HANDOFF.md, TODO.md                           # nota de la migración y de la variable nueva
```

**Structure Decision**: aplicación Next.js única. La lógica reutilizable por el CLI y el servidor vive
en `src/lib/catalog/` (sin imports de `next/*` ni alias `@/`, para que `tsx` la cargue desde
`scripts/`); la orquestación de corridas (que sí usa Supabase y R2) vive aparte en
`src/lib/catalog-runs.ts`; la UI cuelga de la ruta existente `/admin/bulk`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Almacén temporal con fotos **originales** (JPG/PNG a 2000 px de la CDN) en R2, sin `sharp`. Amparado por la cláusula de *artefactos temporales* del principio V (constitución v1.1.0), no es una excepción libre. | Son piezas intermedias del paquete: el staff las vuelve a subir y entonces sí pasan por el pipeline completo (WebP 1280/80 + cuota). Recomprimirlas dos veces degradaría la calidad. | Pasarlas por `sharp` en el almacén: doble compresión con pérdida y más CPU en cada tanda. Guardarlas en la base: hinchan Postgres. No guardarlas y armar el ZIP al vuelo: obliga a re-descargar todo de la tienda en cada descarga y rompe el respeto por la tienda (FR-005). |
| Dependencia nueva `fflate`. | Armar un ZIP en streaming sin cargar cientos de MB en memoria. | Escribir el formato ZIP a mano: frágil. `archiver`/`jszip`: más pesadas, `jszip` carga todo en memoria. |
| Trigger de `updated_at` en `garments` modificado. | `last_seen_at` se actualiza en lote en cada sincronización y no debe contar como "edición" (FR-020). | Dejarlo: cada lectura marcaría todo el catálogo como recién editado y ensuciaría cualquier orden o auditoría por `updated_at`. |
