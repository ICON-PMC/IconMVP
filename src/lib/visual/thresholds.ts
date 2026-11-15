// Umbrales de la búsqueda por foto (spec 005). Calibrados con `npm run visual:eval`
// sobre el catálogo y el set de referencia; revisar al cambiar de modelo.

/** Similitud (coseno) desde la que un resultado cuenta como "muy parecido" (FR-007, FR-011). */
export const SIMILAR_MIN = 0.78; // mediana de similitud entre prendas de la misma categoría del catálogo (2026-11-14)

/** Cuánto más debe parecerse a "no es ropa" que a la mejor categoría para rechazarla. */
export const NOT_CLOTHING_MARGIN = 0.02;

/** Ídem para contenido no permitido (FR-015). Más estricto: preferimos rechazar de más. */
export const BLOCK_MARGIN = 0.0;

/** Empujón por misma categoría al ordenar (debe coincidir con search_by_embedding). */
export const SAME_CATEGORY_BOOST = 0.05;
