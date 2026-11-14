# Contratos: Búsqueda por foto (005)

## HTTP (route handlers de Next.js)

### `POST /api/visual/search` — buscar por foto
- **Body**: `multipart/form-data` con `image` (JPEG/PNG/WebP, ≤ 2 MB, ya recortada y reducida a
  512 px en el cliente). Alternativa: JSON `{ "embedding": number[512] }` para re-buscar con filtros
  sin volver a subir la foto (FR-009).
- **Query**: los mismos filtros de `/feed` (`city`, `price`, `category`, `style`, `occasion`, `color`).
- **200**:
  ```json
  {
    "embedding": [0.01, "...512 números"],
    "detectedCategory": "pantalones",
    "belowThreshold": false,
    "items": [ { "...fila de feed_items (kind = garment)", "similarity": 0.83 } ]
  }
  ```
- **400** `{ "error": "Sube una imagen JPG, PNG o WebP de hasta 2 MB." }`
- **422** `{ "error": "No encontramos ropa en la foto. Prueba con otra o recórtala." }` (sin prendas
  o contenido no permitido — mensaje neutro, FR-015)
- **429** `{ "error": "Hiciste muchas búsquedas por foto. Intenta en un rato." }` (FR-014)
- **503** `{ "error": "La búsqueda por foto no está disponible por ahora." }` (modelo caído o tope mensual)
- Nunca escribe la imagen a disco ni a R2 (FR-012). Sin sesión también funciona.

### `GET /api/visual/warmup`
Precarga el modelo en la instancia (se llama al abrir el selector de foto). `204`.

### `POST /api/embeddings/process` — procesar pendientes
- Auth: header `Authorization: Bearer $CRON_SECRET` (Vercel Cron) o sesión staff.
- Body opcional `{ "garmentIds": string[] }` (reintentar específicos) o `{ "all": true }` (reindexar).
- **200** `{ "processed": n, "ready": n, "failed": n }`. Procesa ≤ 25 por llamada.

## RPC (Postgres, `security definer`, `grant execute to anon, authenticated` salvo indicación)

### `search_by_embedding(p_embedding vector(512), p_limit int default 48, p_cities text[], p_occasions text[], p_styles text[], p_categories text[], p_prices text[], p_colors text[], p_prefer_category text default null)`
Devuelve `setof` (`id uuid`, `similarity real`) de prendas publicadas con embedding `ready`, filtros
aplicados igual que `get_feed`, ordenadas por: misma `p_prefer_category` primero (FR-006), luego
similitud descendente. Solo `service_role` (la llama la ruta; el vector viene de nuestro servidor).

### `similar_garments(p_garment_id uuid, p_limit int default 8, p_min real default <SIMILAR_MIN>)`
Prendas parecidas a una prenda publicada (FR-011): excluye la propia, máximo 2 por marca, solo por
encima del umbral. `anon, authenticated`.

### `photo_search_quota(p_requester text) returns int`
Búsquedas del solicitante en la última hora. Solo `service_role`.

### `visual_index_status() returns table(status text, n int)` y lista de fallidas
Para `/admin` (FR-018). Solo staff.

## UI
- Ícono de cámara en `FeedTopBar` (buscador). Abre una hoja: "Tomar foto" / "Elegir de la galería"
  (móvil) o zona de arrastre (escritorio).
- Página `/feed?visual=1`: miniatura de la foto buscada + "Recortar" + filtros del feed + grilla de
  `FeedCard` + aviso "Esto es lo más cercano" cuando `belowThreshold`.
- `/prenda/[id]`: sección "Más como esta" (hasta 8) + "Ver más" → `/feed?similar=<id>`.
- `/admin` → pestaña de etiquetas o métricas: estado del índice visual + "Reintentar" + métricas
  semanales (FR-020).
