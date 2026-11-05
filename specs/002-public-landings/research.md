# Research: Landings públicas (002)

## R1. Renderizado y sesión
- **Decision**: server components SSR en `/` y `/marcas`. El CTA principal depende de `getCurrentUser()`:
  sin sesión → registro; persona con sesión → `/feed`; marca → `/marca/panel`. La página queda dinámica;
  la petición extra a Auth ya está cacheada por `cache()`.
- **Rationale**: FR-003 + FR-038 (contenido sin JS). El costo de una ruta dinámica es bajo a esta escala.
- **Alternatives**: ISR estático + CTA resuelto en el cliente (provoca un salto visual del botón y
  complica FR-004).

## R2. Tipografía del wordmark
- **Decision**: `Instrument Serif` (400) vía `next/font/google` → variable `--font-display` en el
  `@theme`. Utilidad `.wordmark` con `-webkit-text-stroke: .022em currentColor; paint-order: stroke fill`
  para el trazo más grueso que pidió la dueña. El cuerpo sigue en Geist.
- **Alternatives**: DM Serif Display o Playfair 700 (cambian el carácter aprobado en la maqueta).

## R3. Fotos reales
- **Decision**: `getLandingPhotos(n)` lee `feed_items` (`kind = 'garment'`, con imagen) con el orden
  `relevant` de `get_feed`, que ya reparte por marca, y devuelve título, marca, ciudad, precio,
  `imageUrl(image)` y `/prenda/[id]`. La tarjeta de respuesta del globo usa la primera; los mosaicos
  usan las siguientes. Si no hay suficientes, se muestra un fondo de color de la paleta (sin hueco).
- **Rationale**: la dueña pidió usar fotos ya montadas (principios IV y V). Siempre hay contenido real y
  publicado; no se suben assets nuevos.

## R4. Captura de interés
- **Decision**: una tabla `brand_requests` con `kind` = `assisted | nomination`. La escritura va **solo**
  por la RPC `submit_brand_request` (`security definer`, `search_path = public`, `EXECUTE` para `anon` y
  `authenticated`). La RPC hace lo siguiente:
  - Valida en el servidor (longitudes, contacto como correo o celular colombiano, consentimiento
    obligatorio cuando hay contacto, `assisted` exige todo).
  - Normaliza: Instagram sin `@` y en minúsculas, URL con `https://`, teléfono solo en dígitos con 57.
  - Usa una **clave de idempotencia** (UUID del cliente, `unique`): reintentos y doble clic devuelven
    `duplicate` sin crear una segunda fila (FR-025).
  - Aplica un **límite de frecuencia**: máximo 5 envíos por `ip_hash` cada 10 minutos. `ip_hash` =
    sha256(IP + `LANDING_IP_SALT`) calculado en la server action; no se guarda la IP (FR-027/028).
  - En una `nomination`, si el Instagram o el nombre normalizado coinciden con una marca **activa**,
    devuelve `already_listed` + `slug` y no inserta (US4-4).
  - Calcula `brand_key` (nombre o handle normalizado) para agrupar postulaciones repetidas (US4-3).
- **Anti-bots adicional** (server action): campo trampa oculto y tiempo mínimo de llenado de 2 s. Si
  falla, se responde un éxito falso y no se guarda nada.
- **Alternatives**: policy `insert` para `anon` (sin dedupe ni aviso de marca ya listada); Turnstile o
  captcha (fricción y otro servicio; queda como plan B si llega basura).

## R5. Aviso al equipo por WhatsApp (CallMeBot)
- **Decision**: `src/lib/notify.ts` con `notifyTeam(text)`. Lee `CALLMEBOT_RECIPIENTS`
  (`57300…:apikey,57301…:apikey`), hace un `GET https://api.callmebot.com/whatsapp.php?phone=&text=&apikey=`
  por destinatario con `AbortSignal.timeout(5000)`, captura y registra los errores. Se invoca dentro de
  `after()` en la server action, así que no retrasa ni hace fallar el envío. Sin la variable no hace nada
  (local/Preview).
- **Contenido**: `"Icon · Nueva solicitud de subida asistida: <marca> (<ciudad>). Responder hoy: https://iconcolombia.com/admin?tab=solicitudes"`.
  **Sin** nombre, teléfono ni correo de la persona: CallMeBot es un tercero no oficial, y así no se
  comparten datos personales con él (Ley 1581). Para las postulaciones se avisa también, más corto.
- **Setup**: cada persona del grupo envía el mensaje de activación al bot de CallMeBot desde su WhatsApp,
  recibe su apikey y se agrega a la variable. Está documentado en quickstart.
- **Riesgos**: el servicio puede caerse o limitar el envío → `/admin` es la fuente de verdad, y la pestaña
  "Solicitudes" muestra el contador de pendientes de hoy.
- **Alternatives**: WhatsApp Cloud API (número Business), bot de Telegram, correo (Fase 2).

## R6. Analítica
- **Decision**: tabla `landing_events` + RPC `track_landing_event(landing, event, target, section,
  outcome, utm_*)`. `anon` solo tiene EXECUTE; la RPC valida contra listas cerradas y recorta longitudes.
  El cliente (`track.tsx`) envía `page_view` al montar y un `cta_click` por cada elemento `[data-track]`
  con `navigator.sendBeacon('/api/landing-event')`. El route handler llama la RPC y responde siempre 204.
  Los formularios registran `form_submit` con `outcome` = `ok | error | duplicate | already_listed`
  desde la server action. **Nunca** se guardan datos personales; las UTM se toman de la URL y se recortan
  a 100 caracteres (FR-030, caso borde de parámetros largos).
- **Visitas**: se mantienen también en Vercel Analytics (ya instalado).
- **Panel**: `landing_event_summary(days)` (solo staff) agrega visitas, clics por botón, envíos por
  resultado y origen UTM → pestaña "Landings" en `/admin` (SC-005).
- **Alternatives**: Vercel `track()` (plan Pro, bloqueable), PostHog (otro servicio y cookies).

## R7. Prueba social
- **Decision**: la RPC `landing_stats()` (`security definer`, `EXECUTE` para `anon`) devuelve
  `brands`, `posts` y `people`, cada uno **null** si está bajo el umbral (10 / 50 / 100). Cuenta marcas
  `is_active`, ítems publicados en `feed_items` y `users` con rol `user`. Se redondea hacia abajo con
  "+" en la UI (40 → "40+", 137 → "130+"). Logos: marcas activas con `logo_url`, máximo 12; si no hay,
  la franja no se muestra.

## R8. SEO y compartir
- **Decision**: `metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://iconcolombia.com")`
  en el layout; `metadata` propio por ruta (título y descripción distintos); `opengraph-image.tsx` por
  ruta con `ImageResponse` (wordmark, frase y 4 fotos reales vía `imageUrl`; la fuente se carga como
  ArrayBuffer). Se agregan `sitemap.ts` (`/`, `/marcas`, `/feed`) y `robots.ts` (excluye `/admin`,
  `/marca/panel`, `/api`).

## R9. Privacidad
- **Decision**: `/privacidad` con un borrador estructurado según la Ley 1581/2012 y el Decreto 1377/2013:
  responsable, datos que se recogen, finalidad, derechos (conocer, actualizar, rectificar, suprimir),
  canal de contacto (WhatsApp/correo del equipo), encargados (Supabase, Vercel, CallMeBot sin datos
  personales) y vigencia. Al pie dice "Última actualización". **Release gate**: revisión legal antes de
  mergear a `main`.

## R10. Instagram en "Lo subo yo"
- **Decision**: en la opción A, "Importar desde Instagram" se muestra con la etiqueta **Próximamente**
  mientras `INSTAGRAM_IMPORT_ENABLED` no esté activo en Production (la etiqueta depende de la variable).
