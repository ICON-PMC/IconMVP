---

description: "Lista de tareas de 002-public-landings"
---

# Tasks: Landings públicas para personas y para marcas

**Input**: Design documents from `specs/002-public-landings/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md),
maqueta aprobada [mockups/landings.html](./mockups/landings.html).

**Tests**: no se piden tests automatizados (`TODO(TESTS)` de la constitución). La verificación es
`npm run lint`, `npm run build` y los escenarios de `quickstart.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: US1…US6 del spec

## Reglas transversales (aplican a TODAS las tareas)

- **La UI replica la maqueta aprobada** `mockups/landings.html`: estructura, copy, colores, radios y
  bordes de 1.5px en ink. Se traduce a Tailwind con los tokens de `src/app/globals.css`; no se crean
  colores nuevos.
- Copy en español inclusivo ("persona", "quien…"). Nada se muestra como disponible si no existe (FR-008):
  usar `<SoonBadge />`.
- Ilustraciones: SVG en `src/components/landing/illustrations.tsx`, con `aria-hidden`.
- Fotos: solo `imageUrl()` sobre claves de `feed_items`; nunca URLs de R2 hardcodeadas (principio V).
- Animaciones (rotación del globo y de la ciudad, puntos, caret): desactivadas con `prefers-reduced-motion`.
- Cada enlace o botón de acción lleva `data-track="<target>" data-section="<section>"` según el catálogo
  de `contracts/http-and-events.md`.
- Móvil desde 360 px, sin scroll horizontal; objetivos táctiles ≥ 44 px; inputs de 16 px en móvil.

---

> **Avance 2026-11-05 (rama `landings`)**: implementadas solo las dos landings (US1 + US2, visual).
> Las variables del dominio ya estaban configuradas. Interino: "Solicitar" (subida asistida) y
> "Postular" abren el WhatsApp del equipo con el mensaje armado (`whatsapp-form.tsx`), sin guardar
> nada en Icon. Pendiente para después: migración + RPC, CallMeBot, analítica, cifras/logos, `/admin`,
> `/privacidad`, imágenes OG, sitemap/robots.

## Phase 1: Setup

- [ ] T001 Agregar `NEXT_PUBLIC_SITE_URL`, `LANDING_IP_SALT` y `CALLMEBOT_RECIPIENTS` (con comentario de formato `57XXXXXXXXXX:apikey,…` y el enlace de activación de CallMeBot) a `.env.example`; agregar `NEXT_PUBLIC_SITE_URL=http://localhost:3000` y `LANDING_IP_SALT=dev` a `.env.local`.
- [X] T002 [P] Cargar `Instrument_Serif` (weight 400, subsets latin, `variable: "--font-instrument-serif"`) con `next/font/google` en `src/app/layout.tsx` y agregar su clase al `<html>`; definir `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://iconcolombia.com")` en la metadata raíz.
- [X] T003 [P] En `src/app/globals.css`: agregar `--font-display: var(--font-instrument-serif), Georgia, serif;` al `@theme` y la utilidad `@utility wordmark { font-family: var(--font-display); letter-spacing: .06em; line-height: .86; -webkit-text-stroke: .022em currentColor; paint-order: stroke fill; }`.

---

## Phase 2: Foundational (bloquea todas las historias)

### Base de datos (principios III y IV)

- [ ] T004 Crear `supabase/migrations/20261105000000_landings.sql` con la tabla `brand_requests`, exactamente según `data-model.md`: `kind check (kind in ('assisted','nomination'))`, `brand_name` "obligatorio, 2–80", `link` "≤ 300", `contact_name` "≤ 80", `message` "≤ 500", `source_landing check in ('personas','marcas')`, `utm_*` "≤ 100", `idempotency_key uuid unique`, check "`consent_at` obligatorio si `contact` no es null"; índices `(kind, created_at desc)`, `(brand_key)`, `(ip_hash, created_at)`; RLS habilitado + policy `select` solo `is_staff()`; `grant select on brand_requests to authenticated; grant all to service_role;` y **nada** a `anon`.
- [ ] T005 En la misma migración, crear la tabla `landing_events` según `data-model.md` (`landing in ('personas','marcas')`, `event in ('page_view','cta_click','form_submit')`, `target`/`section` "≤ 40", `outcome` "`ok | error | duplicate | already_listed | rate_limited`", `utm_*` y `referrer_host` "≤ 100", sin IP ni usuario); índice `(landing, created_at)`; RLS `select` solo `is_staff()`; los mismos GRANT que T004.
- [ ] T006 En la misma migración, crear la RPC `submit_brand_request(p jsonb) returns jsonb` (`security definer`, `set search_path = public`) según `contracts/rpc.md`: normalización (IG sin `@` en minúsculas → `https://instagram.com/<handle>`; URL sin esquema → `https://`; teléfono → solo dígitos con prefijo `57`; `contact_kind` email|whatsapp), validación con `errors` por campo en español, `duplicate` por `idempotency_key`, `rate_limited` si hay ≥ 5 filas del mismo `ip_hash` en los últimos 10 min, `already_listed` + `slug` para `nomination` cuyo handle IG o `f_unaccent(lower(name))` coincida con una marca `is_active`, cálculo de `brand_key`, `consent_at = now()` cuando hay contacto y consentimiento. `grant execute … to anon, authenticated`.
- [ ] T007 En la misma migración, crear las RPC `track_landing_event(p jsonb) returns void` (descarta en silencio valores fuera de las listas cerradas, recorta longitudes; EXECUTE anon/authenticated), `landing_stats() returns jsonb` (marcas `is_active`, ítems de `feed_items`, `users.role = 'user'`; devuelve null bajo 10/50/100; EXECUTE anon/authenticated), `landing_event_summary(p_days int default 7) returns jsonb` y `brand_request_list(p_kind text default null, p_limit int default 100)` con `nominations_count` y `already_listed_slug` (estas dos lanzan error si no `is_staff()`; EXECUTE authenticated). Todas `security definer` + `set search_path = public`.
- [ ] T008 Aplicar en local con `supabase db reset` y probar con `docker exec -i supabase_db_Icon psql -U postgres -d postgres`: `select landing_stats();` y un `submit_brand_request` válido, uno duplicado y uno inválido.
- [ ] T009 Actualizar a mano `src/lib/database.types.ts`: `Tables.brand_requests`, `Tables.landing_events` (Row/Insert/Update) y `Functions.submit_brand_request | track_landing_event | landing_stats | landing_event_summary | brand_request_list` con sus Args/Returns.

### Librerías compartidas

- [ ] T010 [P] Crear `src/lib/landing.ts` (server-only) con: `getLandingStats()` → `{brands, posts, people}` vía la RPC `landing_stats` + `formatStat(n)` que redondea hacia abajo con "+" (40 → "40+", 137 → "130+", < 10 exacto); `getLandingPhotos(n)` → prendas de `feed_items` con `kind = 'garment'` e imagen, en orden `get_feed('relevant')`, mapeadas a `{id, title, brand, city, price, src: imageUrl(image), href: '/prenda/'+id}`; `getActiveBrandLogos(limit = 12)` → marcas `is_active` con `logo_url`.
- [ ] T011 [P] Crear `src/lib/notify.ts` (`import "server-only"`) con `notifyTeam(text: string)` según `contracts/http-and-events.md`: parsea `CALLMEBOT_RECIPIENTS`; sin la variable no hace nada; un `GET https://api.callmebot.com/whatsapp.php` por destinatario con `AbortSignal.timeout(5000)` y `Promise.allSettled`; registra los errores con `console.error`; nunca lanza.
- [ ] T012 [P] Crear `src/app/api/landing-event/route.ts` (`runtime = "nodejs"`): `POST` lee el JSON (≤ 2 KB), reduce `referrer` a su host, llama `track_landing_event` con el cliente de servidor y **siempre** responde 204, aunque falle.
- [ ] T013 [P] Crear `src/components/landing/track.tsx` (cliente): prop `landing`; al montar envía `page_view` con las UTM de `location.search` (recortadas a 100); delega los clics del documento sobre `[data-track]` → `cta_click {target, section}`; usa `navigator.sendBeacon` con `fetch(..., {keepalive:true})` como respaldo; todo en try/catch.

### Componentes de landing compartidos (replican la maqueta)

- [X] T014 [P] Crear `src/components/landing/illustrations.tsx`: componentes SVG `PersonRight`, `PersonLeft` (props `fill`, `hair`), `Tee` (prop `fill`), `ShirtHolder`, `ClothesBox`, `Bookmark`, `CurvedArrow`, copiados de los `<symbol>` de la maqueta, con colores tomados de los tokens.
- [X] T015 [P] Crear `src/components/landing/soon-badge.tsx` ("Próximamente", fondo honey con punto coral) y `src/components/landing/section.tsx` (contenedor de sección con el padding de la maqueta).
- [X] T016 Crear `src/components/landing/hero.tsx`: props `steps: [{n, title, text}]×3`, `title` (ReactNode, con `<em>` coral), `lead`, `primary: {href,label,track}`, `secondary?`. Wordmark `IC<span coral>O</span>N` con la utilidad `wordmark` en forest, a `clamp(84px,17vw,200px)`; grid de 3 tarjetas (coral-soft / honey-soft / leaf-soft, borde 1.5px ink, número serif arriba a la izquierda **dentro** del borde de la página); SVG de líneas que bajan de las tarjetas y convergen en el horizonte (paths de la maqueta, `vector-effect: non-scaling-stroke`); **sin el arco hacia el logo**. En móvil (< 640 px) las tarjetas muestran solo número y título. El titular y los CTA quedan visibles sin scroll en 360×640 y 1366×768.
- [X] T017 [P] Crear `src/components/landing/landing-header.tsx`: header `.glass` redondeado con el wordmark pequeño, switch "Soy persona / Tengo una marca" (`aria-current` en la activa, `data-track="go_brands|go_people"`) y "Entrar" (o "Mi panel"/"Explorar" con sesión, vía `getCurrentUser`).
- [X] T018 [P] Crear `src/components/landing/landing-footer.tsx`: pie forest-deep con borde superior ondulado (SVG de la maqueta), wordmark, columnas de enlaces por audiencia (prop `audience`), WhatsApp `+57 315 242 9478` (reusar `CONTACT_PHONE` de `site-footer.tsx`) y enlace a `/privacidad`.
- [X] T019 [P] Crear `src/components/landing/dialogue-scene.tsx` (cliente para la rotación): props `bg` (forest-deep | coral), `phrases: ReactNode[]`, `answer` (ReactNode: tarjeta de prenda o puntos "escribiendo"), colores de las personas; layout de 4 columnas en escritorio y 2 filas en móvil, como en la maqueta; rota cada 3.8 s salvo con `prefers-reduced-motion`.
- [ ] T020 Crear `src/app/privacidad/page.tsx`: borrador del aviso de tratamiento de datos (Ley 1581/2012, Decreto 1377/2013) según research R9: responsable, datos, finalidades, derechos, canal, encargados (Supabase, Vercel; CallMeBot sin datos personales), vigencia y "Última actualización: 2026-11-05". Comentario `// BORRADOR: requiere revisión legal antes de release a main`. Metadata propia.

**Checkpoint**: la migración está aplicada en local, los tipos están al día y los componentes compartidos renderizan.

---

## Phase 3: User Story 1 — Una marca entiende la propuesta y elige cómo subir (P1) 🎯 MVP

**Goal**: `/marcas` completa (salvo el formulario funcional, que es US3) con la propuesta, "¿Cómo subo?", la escena, "Tu panel", el recorrido y el cierre.

**Independent Test**: quickstart escenarios 2, 3 (marca con sesión → panel) y 4.

- [X] T021 [US1] Crear `src/app/marcas/page.tsx` (server component, dinámico): `LandingHeader` (audiencia marcas) + `Hero` con pasos Crea / Etiqueta / Vende (textos de la maqueta), titular "Tu marca frente a quien busca *justo lo que haces*.", CTA único "Únete ya" → `#como` (si la sesión es de marca: "Ir a mi panel" → `/marca/panel`, FR-003), `data-track="join" data-section="hero"`; `<Track landing="marcas" />`; `export const metadata` con título y descripción propios.
- [X] T022 [P] [US1] Crear `src/components/landing/how-to-upload.tsx`: título "¿Cómo *subo* mi catálogo?" y dos tarjetas lado a lado (columna única < 700 px): **A. Tú** (leaf-soft; checks: crear cuenta y perfil, subir una por una o con Excel, etiquetar y armar looks, "Importar desde Instagram" con `SoonBadge` si `process.env.INSTAGRAM_IMPORT_ENABLED !== "true"`; "Tú pones": fotos, precios y tallas; enlace a tienda o WhatsApp; botón "Crea tu cuenta" → `/signup?tipo=marca`, `data-track="signup_brand"`) y **B. Nosotros** (blush; sello rotado "GRATIS por ahora"; checks y "Tú pones" de la maqueta; slot `children` para el botón "Solicitar" de US3). Ambas con "Revisamos cada perfil antes de publicarlo." (FR-009/010).
- [X] T023 [P] [US1] Crear `src/components/landing/brand-panel-preview.tsx`: "Tu *panel*" con el mock (dona conic-gradient, filas Prendas/Looks/Borradores/Estado, tiles, barra de espacio usado) y la tarjeta de descripción con **solo** lo que existe hoy + "Cuántas personas fueron a tu tienda o tu WhatsApp" con `SoonBadge` (FR-011). Mock decorativo con `aria-hidden`.
- [X] T024 [P] [US1] Crear `src/components/landing/post-to-store-flow.tsx`: "De tu publicación *a tu tienda*." con tu post en el feed → la prenda (pin con el nombre) → tu página / tu WhatsApp, con `CurvedArrow` (rotada 90° en móvil); usa 5 fotos de `getLandingPhotos` (FR-012).
- [X] T025 [US1] Completar `src/app/marcas/page.tsx` en el orden de la maqueta: `HowToUpload` → `DialogueScene` (bg coral, "Quiero algo para *una cena en Bogotá*…" + puntos) con el texto "En Icon la gente busca por lo que va a hacer, no por marca…" (FR-013) → `BrandPanelPreview` → `PostToStoreFlow` → CTA grande "Únete ya" (`data-section="cierre"`) → `LandingFooter audience="marcas"` (FR-014).

**Checkpoint**: `/marcas` navegable y fiel a la maqueta en escritorio y móvil.

---

## Phase 4: User Story 2 — Una persona entiende la propuesta y crea cuenta o explora (P1)

**Goal**: reescribir `/` como landing de personas.

**Independent Test**: quickstart escenarios 1, 3 y 17.

- [X] T026 [US2] Reescribir `src/app/page.tsx` (server, dinámico): `LandingHeader` (personas) + `Hero` con Busca / Muestra / Compra, titular "Encuentra lo que necesitas, *hecho en Colombia*.", lead de la maqueta, primario "Crea tu cuenta" → `/signup` (con sesión: "Ir al feed" → `/feed`) y secundario "Explorar el feed" → `/feed`; `<Track landing="personas" />`; metadata propia. Mover el FAQ de marcas actual a `/marcas` solo si no contradice la maqueta; si no, eliminarlo.
- [X] T027 [US2] Agregar a `src/app/page.tsx` la `DialogueScene` (bg forest-deep) con las 4 frases "Necesito un…" de la maqueta y como respuesta la **primera prenda de `getLandingPhotos`** (foto, título, marca · ciudad, precio, chips), enlazada a su `/prenda/[id]` (FR-016).
- [X] T028 [P] [US2] Crear `src/components/landing/search-section.tsx`: panel sky con `ShirtHolder` y "Busca todo lo que *necesites*." con filas de chips de ejemplo Ocasión / Ciudad / Precio / Estilo (toggles decorativos de cliente) y el botón "Buscar en el feed →" que arma `/feed?…` con los chips activos (`data-track="search_feed" data-section="busca"`) (FR-015).
- [X] T029 [P] [US2] Crear `src/components/landing/coming-soon-sections.tsx`: "Comparte tu *estilo*." (teléfono con `iconcolombia.com/me`, avatar, 4 fotos reales, sombra coral, `SoonBadge`, botón "Crea tu cuenta" → `/signup`) y "Escribe *reseñas*." (panel honey, 3 reseñas con estrellas + 1 foto, `SoonBadge`), sin enlaces a funciones inexistentes (FR-017).
- [X] T030 [P] [US2] Crear `src/components/landing/saved-section.tsx`: `ClothesBox` + tablero con 3 fotos reales y `Bookmark`; "Guarda todos tus gustos *para después*." con 3 checks (guardar, like, seguir marcas) (FR-015).
- [X] T031 [P] [US2] Crear `src/components/landing/city-cta.tsx` (cliente para la rotación): "Mejora tu estilo con ropa de <u>tu ciudad</u>." con la palabra resaltada en honey rotando Barranquilla/Medellín/Bogotá, botón grande "Crea tu cuenta" (`data-section="ciudad"`) y "Gratis. Barranquilla · Medellín · Bogotá." (FR-019).
- [X] T032 [US2] Componer `src/app/page.tsx` en el orden de la maqueta: hero → escena → busca → comparte → reseñas → guarda → (slot postula de US4) → ciudad → `LandingFooter audience="personas"`.

**Checkpoint**: `/` y `/marcas` completas visualmente; MVP visual listo para mostrar.

---

## Phase 5: User Story 3 — Una marca pide la subida asistida (P1)

**Goal**: el formulario funcional en "Nosotros", guardado, aviso por WhatsApp y confirmación del mismo día hábil.

**Independent Test**: quickstart escenarios 5, 6, 7 y 8.

- [ ] T033 [US3] Crear `src/app/landing/actions.ts` con `submitAssisted(prev, formData)` según `contracts/http-and-events.md`: trampa `website` + `started_at` < 2 s → éxito falso; `ip_hash` = sha256(`x-forwarded-for`[0] + `LANDING_IP_SALT`) con `node:crypto`; llama `submit_brand_request` con `kind: 'assisted'`, `source_landing: 'marcas'` y las UTM; registra `form_submit` con su outcome; si `ok`: `after(() => notifyTeam("Icon · Subida asistida: {marca} ({ciudad}). Responder hoy → {SITE_URL}/admin?tab=solicitudes"))` **sin datos de contacto**; devuelve `{status, errors}`.
- [ ] T034 [US3] Crear `src/components/landing/assisted-request.tsx` (cliente): botón "Solicitar" (`data-track="open_assisted"`, `aria-expanded`) que despliega el panel con borde y sombra coral-soft; formulario con `useActionState(submitAssisted)`: marca, tu nombre, WhatsApp o correo, tienda online o Instagram, ciudad (select Barranquilla/Medellín/Bogotá/Otra), mensaje opcional, checkbox de consentimiento con enlace a `/privacidad`; ocultos `idempotency_key` (`crypto.randomUUID()` al montar), `started_at`, `website` y UTM; inputs `.glass-input`; errores junto a cada campo con `aria-describedby` y valores conservados; botón deshabilitado mientras envía; confirmación: "Recibimos tu solicitud. Te escribimos **hoy mismo** por WhatsApp o correo (el que nos dejaste). Si nos escribes fuera de horario o en fin de semana, te respondemos el siguiente día hábil." con `role="status"` y foco (FR-022/024/025).
- [ ] T035 [US3] Insertar `<AssistedRequest />` en el slot de la tarjeta B de `src/components/landing/how-to-upload.tsx`; que "Únete ya" y "Subida asistida" del pie hagan scroll a `#como`.
- [ ] T036 [US3] Agregar la pestaña "Solicitudes" en `src/app/admin/admin-tabs.tsx` (`"solicitudes"` en `TABS`, badge con las solicitudes asistidas de hoy) y crear `src/app/admin/_components/requests-tab.tsx` que use `brand_request_list`: dos listas (Subida asistida / Postulaciones), cada fila con fecha, marca, enlace, ciudad, contacto, mensaje, origen y UTM, **botón "Responder por WhatsApp"** (`https://wa.me/<tel>?text=` con el saludo de Icon ya escrito) o `mailto:`; en las postulaciones, "N postulaciones" y el enlace a la marca si ya está listada. Renderizarla desde `src/app/admin/page.tsx` con `requireStaff()` (FR-026).

**Checkpoint**: una solicitud real llega a `/admin` y al WhatsApp del grupo.

---

## Phase 6: User Story 4 — Una persona postula una marca (P2)

**Goal**: "Postula una marca" funcional en `/`.

**Independent Test**: quickstart escenarios 9, 10 y 11.

- [ ] T037 [US4] Agregar `submitNomination(prev, formData)` a `src/app/landing/actions.ts` (mismas defensas que T033; `kind: 'nomination'`, `source_landing: 'personas'`); si `ok`: `after(() => notifyTeam("Icon · Postulación de marca: {marca} ({n}ª vez). → …/admin?tab=solicitudes"))`; devuelve `slug` cuando es `already_listed`.
- [ ] T038 [US4] Crear `src/components/landing/nomination-form.tsx` (cliente): panel leaf-soft "¿Qué marca quieres ver en *Icon*?"; campos nombre de la marca e Instagram o enlace (obligatorios), ciudad (opcional) y tu WhatsApp o correo (opcional); el checkbox de consentimiento **aparece solo si hay contacto** y entonces es obligatorio (FR-023); ocultos como en T034; estados: errores por campo, aviso honey "Esa marca ya está en Icon. Ver su perfil →" (`/marca/[slug]`), confirmación "¡Gracias por postularla!…".
- [ ] T039 [US4] Insertar `<NominationForm />` con `id="postula"` en `src/app/page.tsx` entre "Guarda" y "Ciudad"; enlace "Postula una marca" en el pie de personas.

---

## Phase 7: User Story 5 — El equipo mide qué funciona (P2)

**Goal**: los eventos llegan y se ven en `/admin`.

**Independent Test**: quickstart escenarios 12 y 13.

- [ ] T040 [US5] Revisar que cada CTA de `/` y `/marcas` (hero, secciones, cierre, header y footer) tenga `data-track` y `data-section` del catálogo de `contracts/http-and-events.md`; los botones "Postular" y "Solicitar" del formulario no llevan `data-track` (se miden como `form_submit` en el servidor).
- [ ] T041 [US5] Agregar la pestaña "Landings" en `src/app/admin/admin-tabs.tsx` y crear `src/app/admin/_components/landing-metrics-tab.tsx` con `landing_event_summary(7|30)` (selector de días): visitas por landing, % que pulsó el CTA principal (`signup`/`join` sobre `page_view`), tabla de clics por botón/sección, envíos por resultado y top de orígenes (utm_source/campaign/referrer) (SC-005).

---

## Phase 8: User Story 6 — Prueba social (P3)

**Independent Test**: quickstart escenario 14.

- [ ] T042 [P] [US6] Crear `src/components/landing/stats-strip.tsx` (server): 3 tarjetas (coral-soft / honey-soft / sky) con `formatStat` de `getLandingStats()`; oculta cada contador null y toda la franja si los tres son null, sin dejar hueco (FR-020).
- [ ] T043 [P] [US6] Crear `src/components/landing/brand-logos.tsx` (server): logos circulares (borde 1.5px ink) de `getActiveBrandLogos()` con `alt` = nombre y enlace a `/marca/[slug]`; no renderiza nada si no hay logos (FR-021).
- [ ] T044 [US6] Insertar `StatsStrip` y `BrandLogos` en `src/app/marcas/page.tsx` después del CTA "Únete ya" de cierre, como en la maqueta.

---

## Phase 9: Polish & Cross-Cutting

- [ ] T045 [P] Crear `src/app/opengraph-image.tsx` y `src/app/marcas/opengraph-image.tsx` con `ImageResponse` (1200×630) replicando la vista "Al compartir" de la maqueta (wordmark Instrument Serif cargado como ArrayBuffer, frase y 4 fotos reales de `getLandingPhotos` vía `imageUrl`); `alt` propio en cada una (FR-037).
- [ ] T046 [P] Crear `src/app/sitemap.ts` (`/`, `/marcas`, `/feed`, `/privacidad` con `NEXT_PUBLIC_SITE_URL`) y `src/app/robots.ts` (disallow `/admin`, `/marca/panel`, `/api`, `/settings`) (FR-038).
- [ ] T047 Revisar la accesibilidad de ambas landings: un solo `h1`, jerarquía de `h2`, foco visible coral, todo usable con teclado, `aria-hidden` en lo decorativo, `alt` en las fotos (título de la prenda), contraste AA del texto sobre coral-soft/honey-soft/sky, `prefers-reduced-motion` (FR-036).
- [ ] T048 Revisar el rendimiento: fotos con `next/image` o `<img loading="lazy" decoding="async">` bajo el pliegue y `sizes` correctos; la primera foto de la escena sin lazy si está sobre el pliegue en escritorio; componentes de cliente mínimos.
- [ ] T049 Agregar enlaces a `/marcas` en `src/components/site-footer.tsx` y a `/privacidad`; revisar que `SiteHeader` (rutas internas) siga funcionando y que su enlace "Icon" lleve a `/`.
- [ ] T050 `npm run lint && npm run build` sin errores; recorrer los escenarios 1–18 de `quickstart.md` en local, en escritorio y en el modo móvil (360 px) de las DevTools, y anotar los resultados para el PR.
- [ ] T051 Despliegue (según `plan.md`): aplicar la migración a la nube por MCP **antes** de mergear; documentar en `HANDOFF.md` las variables nuevas, la activación de CallMeBot y la puerta legal de `/privacidad`; actualizar `TODO.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (T001–T003) → Foundational (T004–T020) → historias.
- T004–T007 son la misma migración (secuenciales) → T008 → T009.
- US1 (Phase 3) y US2 (Phase 4) dependen solo de Foundational; se pueden hacer en paralelo.
- US3 depende de US1 (slot de la tarjeta B) y de T006/T011.
- US4 depende de US2 (slot en `/`) y de T006/T011.
- US5 depende de T007, T012 y T013, y de que existan las páginas (US1 y US2).
- US6 depende de T007/T010 y de US1.
- Polish al final; T051 es el último.

### Dentro de cada historia

Componentes [P] → composición de la página → verificación con su escenario de quickstart.

## Parallel Opportunities

- Setup: T002 ∥ T003.
- Foundational: T010 ∥ T011 ∥ T012 ∥ T013 ∥ T014 ∥ T015 ∥ T017 ∥ T018 ∥ T019 (tras T009 para los tipos).
- US1: T022 ∥ T023 ∥ T024 → T025.
- US2: T028 ∥ T029 ∥ T030 ∥ T031 → T032.
- US1 ∥ US2 completas; luego US3 ∥ US4.
- US6: T042 ∥ T043.
- Polish: T045 ∥ T046.

## Implementation Strategy

1. **MVP visual (US1 + US2)**: ambas landings fieles a la maqueta, con CTA hacia el registro y el feed
   existentes. Ya se puede mostrar en Preview.
2. **Captura (US3, luego US4)**: subida asistida con aviso de WhatsApp (es la promesa del mismo día) y
   luego la postulación.
3. **Medición (US5)** antes de lanzar campañas.
4. **Prueba social (US6)**: aparece sola cuando se cruza el umbral.
5. Release a `main` solo con la migración en la nube, las variables configuradas y `/privacidad` revisada.
