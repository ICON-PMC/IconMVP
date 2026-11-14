# Research: Búsqueda por foto (005)

Fecha: 2026-11-14. Restricción de la dueña: costo ~USD 0. Base compartida dev/prod.

## R1. Dónde calcular la huella visual (embedding) sin costo

**Decisión**: modelo abierto **FashionCLIP** (ViT-B/32 ajustado con moda, licencia MIT), encoder de
imagen cuantizado en ONNX (~89 MB, vector de 512 dimensiones), ejecutado con **onnxruntime en modo
WASM dentro de una función de Vercel** (Node). El mismo código sirve para indexar el catálogo y para
la foto de la persona.

**Rationale**:
- Costo USD 0: corre en el cómputo de Vercel que ya pagamos; no hay API externa ni datos que salgan.
- Privacidad (FR-012/013): la foto nunca sale de nuestra función ni se guarda.
- Especializado en ropa: mejor parecido entre prendas que CLIP genérico.
- Cabe en el límite de función de Vercel (~250 MB descomprimido). El modelo **no** se empaqueta: se
  descarga de nuestro bucket R2 a `/tmp` en el arranque en frío y queda en memoria mientras la
  instancia vive (Fluid compute).
- El backend WASM evita el `.so` nativo de `onnxruntime-node`, que falla en Vercel (mismo tipo de
  problema que ya vivimos con `sharp`/libvips).

**Alternatives considered**:
| Opción | Por qué no |
|---|---|
| Cloudflare Workers AI | No ofrece modelo de embeddings de imagen (solo texto y LLM de visión). |
| Hugging Face Inference Providers | Créditos gratis eliminados para cuentas free (oct. 2026, no verificado en la doc oficial); dependencia externa. |
| Supabase Edge Functions | Límites de CPU/memoria insuficientes para un ViT; su IA integrada solo hace embeddings de texto. |
| En el navegador de la persona (transformers.js) | Descargar ~89 MB en 4G rompe SC-002 (5 s) en la primera búsqueda. |
| MobileCLIP2 (Apple, 43 MB) | Licencia `apple-amlr`: solo investigación, prohíbe uso comercial. |
| Marqo-FashionSigLIP | Candidato de reemplazo si FashionCLIP no alcanza SC-001; evaluar licencia y tamaño antes. |
| Claude Haiku describiendo la foto → búsqueda por etiquetas | Barato (centavos) pero no es USD 0 y no mide parecido visual real. Queda como respaldo. |

**Riesgo**: arranque en frío ~3–6 s (descarga del modelo de R2 + inicialización WASM). Mitigación:
Fluid compute reutiliza instancias; una ruta de "calentamiento" que el cliente llama al abrir el
buscador de cámara (antes de que la persona tome la foto).

## R2. Almacenamiento y comparación

**Decisión**: extensión **`pgvector`**, columna `vector(512)` normalizada, distancia coseno
(`<=>`), índice **HNSW** `vector_cosine_ops`.

**Rationale**: la constitución (enmienda 1.2.0) permite pgvector para similitud visual. Con 236
prendas una búsqueda exacta es instantánea; el índice HNSW cuesta casi nada y sostiene un catálogo
10–100 veces mayor. Los filtros del feed se aplican en la misma consulta (join con `feed_items`).

**Alternatives**: comparar en memoria en Node (no escala, duplica datos); servicio vectorial externo
(prohibido sin justificación).

## R3. Varias prendas en la foto (FR-004)

**Decisión (MVP)**: **recorte manual** en el cliente. Por defecto se busca con la foto completa; la
persona puede ajustar un recuadro y volver a buscar sin subir la foto de nuevo (el recorte se hace en
el navegador y solo se envía el recorte, reducido a 512 px).

**Detección automática con recuadros**: diferida. No encontramos un detector de prendas pequeño, con
licencia comercial y verificable en este research. Opciones para una iteración siguiente: (a) detector
YOLO-n entrenado en Fashionpedia/DeepFashion2 exportado a ONNX (~10 MB) si se confirma licencia;
(b) Claude Haiku devolviendo recuadros (centavos por búsqueda). **Requiere decisión de la dueña** —
afecta la Historia 2 del spec (P1).

## R4. Categoría de la prenda buscada (FR-006) y contenido inapropiado (FR-015) sin modelo de texto

**Decisión**: precalcular **una sola vez, fuera de línea**, los vectores de texto de FashionCLIP para
frases fijas ("a photo of jeans", "a photo of a dress"… una por categoría de Icon; y unas frases de
contenido no permitido) y guardarlos como constantes en el código. En tiempo de búsqueda solo se
calcula el vector de la imagen y se compara con esas constantes. Así no hace falta el encoder de
texto en producción (ahorra ~60 MB y tiempo).

- Categoría detectada = la frase de categoría más parecida, confirmada por voto de los 10 vecinos más
  cercanos del catálogo. Se usa para priorizar la misma categoría (FR-006) y se registra (FR-019).
- Contenido inapropiado: si la foto se parece más a las frases bloqueadas que a cualquier prenda por
  encima de un umbral, se rechaza con mensaje neutro (FR-015). La foto ya no se guarda en ningún caso.

## R5. Indexación del catálogo (FR-016 a FR-018)

**Decisión**:
- Tabla `garment_embeddings` con estado (`pending` / `ready` / `failed`) y la clave de imagen usada.
- **Trigger** en `garment_images` (insert/update de la posición 0) y en `garments` (pasa a
  `published`) que marca la fila como `pending`. No calcula nada: solo marca.
- Las acciones del servidor que publican o cambian la foto llaman, con `after()` de Next, a la función
  que procesa los pendientes de esa prenda (respuesta inmediata; cálculo después).
- Respaldo: ruta protegida `/api/embeddings/process` que procesa hasta N pendientes; la llama un
  **Vercel Cron** (cada 5 min en plan Pro; diario en Hobby) y el botón "Reintentar" de `/admin`.
- Carga inicial de las 236 prendas: script `npm run db:embed` (mismo código, corre en local contra la
  nube con service role).
- Despublicar/archivar: `feed_items` ya excluye lo no publicado, así que desaparece de inmediato
  (FR-017) sin borrar el vector.

## R6. Límite de uso y medición (FR-014, FR-019)

**Decisión**: tabla `photo_searches` (sin imagen): hash del IP + día, si hay sesión el id de usuario
(nunca la foto), categoría detectada, similitud máxima, número de resultados, tipo (`photo` /
`similar`). El límite (30/hora por IP o usuario) se cuenta sobre esa tabla. Tope mensual configurable
como variable de entorno (`PHOTO_SEARCH_MONTHLY_CAP`); al alcanzarlo la cámara muestra "no disponible
por ahora". Retención 180 días.

## R7. Entrada de la foto (FR-002/003)

**Decisión**: `<input type="file" accept="image/*" capture="environment">` en móvil (abre cámara o
galería) y arrastrar/soltar en escritorio. El navegador convierte HEIC a JPEG en iOS al leerla en un
`<canvas>`; el cliente reduce a 512 px, quita EXIF y envía JPEG (~50–80 KB). El servidor rechaza
> 2 MB o tipos no imagen. `sharp` (import lazy) normaliza a 224×224 para el modelo.

## R8. Volver a los resultados sin subir la foto (FR-009)

**Decisión**: el cliente guarda en `sessionStorage` el **vector** (512 números) y una miniatura de
la foto (data URL pequeña). La página de resultados acepta el vector desde el cliente; recargar o
volver atrás reutiliza el vector. Al cerrar la pestaña se borra (FR-012). No se guarda nada en el
servidor.

## Sources
- [Workers AI — modelos](https://developers.cloudflare.com/workers-ai/models/embedding)
- [Hugging Face Inference Providers — precios](https://huggingface.co/docs/inference-providers/pricing)
- [Créditos gratis de HF eliminados (oct. 2026)](https://www.usagepricing.com/blueprint/activity/hugging-face-2026-10-15-free-inference-credits-removed)
- [onnxruntime en Vercel: usar backend WASM](https://www.technetexperts.com/vercel-onnxruntime-so-fix/)
- [FashionCLIP (MIT)](https://huggingface.co/patrickjohncyh/fashion-clip) · [ONNX cuantizado (ff13)](https://huggingface.co/ff13/fashion-clip/tree/main/onnx)
- [MobileCLIP2 — licencia apple-amlr](https://huggingface.co/apple/MobileCLIP2-B/blob/main/README.md)
- [Marqo-FashionSigLIP ONNX](https://huggingface.co/Marqo/marqo-fashionSigLIP/tree/main/onnx)
