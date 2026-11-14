# Quickstart / validación: Búsqueda por foto (005)

## Prerrequisitos
- Supabase local con las migraciones (`supabase migration up`) y catálogo de prueba importado.
- Modelo FashionCLIP cuantizado subido a R2 (`models/fashion-clip-vit-b32-q8.onnx`) y la variable
  `VISUAL_MODEL_URL` en `.env.local` / Vercel. Ver [research.md](research.md) R1.
- `CRON_SECRET` y `PHOTO_SEARCH_MONTHLY_CAP` definidos.

## 1. Indexar el catálogo
```bash
npm run db:embed
```
Esperado: todas las prendas publicadas en `ready`; `/admin` muestra 100 % buscables (FR-018).

## 2. Set de referencia (SC-001)
`specs/005-busqueda-por-foto/referencia/` con 30 fotos: 10 de prendas del catálogo fotografiadas de
nuevo y 20 de inspiración externa (+ `esperado.json` con la categoría y, si aplica, el id esperado).
```bash
npm run visual:eval
```
Esperado: ≥ 80 % con resultado correcto en el top 6; ≥ 90 % de las del catálogo con la propia prenda
primera. Imprime los umbrales sugeridos para `SIMILAR_MIN` y `BLOCK_MIN`.

## 3. Escenarios manuales (en el navegador, móvil 375 px y escritorio)
| # | Paso | Esperado | Spec |
|---|---|---|---|
| 1 | Tocar la cámara en `/feed` y elegir una foto de un jean | Grilla de jeans parecidos en < 5 s, miniatura arriba | US1, SC-002 |
| 2 | Foto de outfit completo → "Recortar" sobre el pantalón | Resultados cambian a pantalones sin volver a subir | US2 (MVP) |
| 3 | Aplicar ciudad + precio | Solo cumple filtros, sigue ordenado por parecido | US3 |
| 4 | Abrir una ficha y volver atrás / recargar | Mismos resultados sin subir la foto | FR-009 |
| 5 | Foto de un paisaje | "No encontramos ropa en la foto…" | US2 AS4 |
| 6 | 31 búsquedas seguidas | Mensaje de límite en la 31 | FR-014 |
| 7 | Ficha de prenda | "Más como esta" con ≤ 8, ≤ 2 por marca, sin la propia | US4 |
| 8 | Publicar prenda nueva y esperar ≤ 5 min | Aparece en búsqueda por foto | US5, FR-016 |
| 9 | Archivar esa prenda | Desaparece de inmediato | FR-017 |
| 10 | Revisar R2 y la base tras las pruebas | Ninguna foto de usuario guardada | FR-012, SC-005 |

## 4. Puertas de calidad
`npm run lint` · `npm run build` · revisar logs de la función en Vercel Preview (tiempo de arranque en
frío y de inferencia).
