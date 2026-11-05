# Quickstart / validación: Landings públicas (002)

## Preparación local

```bash
supabase start && supabase db reset     # aplica 20261105000000_landings.sql + seed
npm run dev                             # http://localhost:3000
```
`.env.local`: `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `LANDING_IP_SALT=dev`. Para probar WhatsApp,
agrega `CALLMEBOT_RECIPIENTS` con tu número (ver "Activar CallMeBot").

## Escenarios

| # | Escenario | Resultado esperado |
|---|---|---|
| 1 | `/` sin sesión, viewport 360×640 y 1366×768 | Sin scroll se ven ICON, los 3 pasos (Busca·Muestra·Compra), el titular y "Crea tu cuenta" (FR-004, SC-002). Sin scroll horizontal. |
| 2 | `/marcas` sin sesión, mismos viewports | ICON, los 3 pasos (Crea·Etiqueta·Vende), el titular y "Únete ya" visibles sin scroll. |
| 3 | `/` con sesión `maria@icon.co` | El CTA principal lleva a `/feed` (FR-003). `/marcas` con una cuenta de marca → `/marca/panel`. |
| 4 | "Lo subo yo" → "Crea tu cuenta" | `/signup?tipo=marca` con el tipo de marca preseleccionado. |
| 5 | "Solicitar" → enviar el formulario vacío | Errores en español junto a cada campo; nada se borra. |
| 6 | Solicitud válida | La confirmación dice "hoy mismo… siguiente día hábil". La fila aparece en `/admin?tab=solicitudes`; llega el WhatsApp (si está configurado) **sin** el teléfono ni el correo de la persona. |
| 7 | Doble clic en "Solicitar" o recarga con reenvío | Una sola fila (`idempotency_key`) (SC-004). |
| 8 | 6 envíos seguidos desde la misma IP | El 6.º devuelve `rate_limited` con mensaje en español. |
| 9 | Postular "Meraki denim" (marca activa) | "Esa marca ya está en Icon" + enlace a su perfil; no se crea fila. |
| 10 | Postular dos veces una marca nueva (con y sin "@") | `/admin` muestra "2 postulaciones" para esa marca. |
| 11 | Postulación sin contacto | No se pide el consentimiento; se guarda sin datos personales. Con contacto, el consentimiento es obligatorio. |
| 12 | Visitar `/?utm_source=ig&utm_campaign=lanzamiento`, pulsar CTAs y enviar formularios | La pestaña `/admin?tab=landings` muestra visitas, clics por botón/sección, envíos por resultado y el origen (SC-005). `landing_events` no contiene datos personales. |
| 13 | Con bloqueador de anuncios / `/api/landing-event` caído | Todo funciona igual (FR-031). |
| 14 | Contadores bajo el umbral (BD local) | El contador no aparece y no deja hueco; con 10/50/100+ aparece con "+". |
| 15 | Compartir `/` y `/marcas` (opengraph.xyz o la vista previa de WhatsApp) | Título, descripción e imagen distintos (FR-037). |
| 16 | Teclado (Tab) en las dos landings | Foco visible, se pueden enviar los formularios, el switch de audiencia funciona. Con `prefers-reduced-motion` no rotan los textos. |
| 17 | `curl -s localhost:3000/ | grep "Encuentra lo que necesitas"` | El contenido principal está en el HTML del servidor (FR-038). |
| 18 | `npm run lint && npm run build` | Pasan. Lighthouse móvil en `/`: rendimiento ≥ 85 y accesibilidad ≥ 95. |

## Activar CallMeBot (cada persona del grupo, una vez)

1. Guardar el número de CallMeBot que indica https://www.callmebot.com/blog/free-api-whatsapp-messages/
   y enviarle por WhatsApp el mensaje de activación que indica la página.
2. Copiar la apikey que responde el bot.
3. En Vercel (Production + Preview), agregar la persona a `CALLMEBOT_RECIPIENTS` como `57XXXXXXXXXX:apikey`
   (separados por coma) y hacer Redeploy.

## Despliegue

1. Aplicar `20261105000000_landings.sql` a la nube (MCP) → verificar las RPC con un `select landing_stats();`.
2. Configurar en Vercel `NEXT_PUBLIC_SITE_URL`, `LANDING_IP_SALT` y `CALLMEBOT_RECIPIENTS` →
   Redeploy **sin** build cache.
3. Supabase Auth: Site URL `https://iconcolombia.com` + Redirect URLs.
4. PR `landings` → `dev`; validar los escenarios en Preview.
5. **Antes de `dev` → `main`**: revisión legal de `/privacidad`.
