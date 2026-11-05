# Contrato: server actions, endpoint de eventos y avisos (002)

## Server actions — `src/app/landing/actions.ts`

`submitAssisted(prev, formData)` y `submitNomination(prev, formData)` (para `useActionState`).

1. Leen los campos y los ocultos: `idempotency_key`, `started_at` (ms) y `website` (trampa); además las UTM.
2. Si la trampa tiene valor o pasaron menos de 2 s: devuelven `{status:"ok"}` sin guardar.
3. Calculan `ip_hash` = sha256(`x-forwarded-for`[0] + `LANDING_IP_SALT`).
4. Llaman `submit_brand_request` con el cliente de Supabase del servidor (rol del visitante, sin service_role).
5. Registran `form_submit` con su `outcome` (`track_landing_event`).
6. Si `ok`: `after(() => notifyTeam(...))`.
7. Devuelven `{status, errors?, slug?}`. El formulario muestra los errores junto a cada campo y conserva
   los valores (FR-025).

Mensajes de confirmación (FR-024):
- **assisted**: "Recibimos tu solicitud. Te escribimos hoy mismo por WhatsApp o correo (el que nos
  dejaste). Si nos escribes fuera de horario o en fin de semana, te respondemos el siguiente día hábil."
- **nomination**: "¡Gracias por postularla! El equipo revisa cada postulación y contacta a la marca. Si
  nos dejaste tu contacto, te avisamos cuando entre."
- **already_listed**: "Esa marca ya está en Icon." + enlace a `/marca/[slug]`.
- **rate_limited**: "Recibimos muchos envíos seguidos. Intenta de nuevo en unos minutos."
- **duplicate**: se muestra la misma confirmación que `ok`.

## `POST /api/landing-event`

Body JSON (`sendBeacon`, ≤ 2 KB): `{landing, event, target?, section?, utm?, referrer?}`. El handler
reduce `referrer` a su host, llama `track_landing_event` y **siempre** responde `204`, aunque falle
(FR-031). `runtime = "nodejs"`.

## Catálogo de eventos

| landing | event | target | section |
|---|---|---|---|
| personas | page_view | — | — |
| personas | cta_click | `signup` · `explore_feed` · `search_feed` · `go_brands` | `hero` · `busca` · `comparte` · `ciudad` · `header` · `footer` |
| personas | form_submit | `nomination` | `postula` |
| marcas | page_view | — | — |
| marcas | cta_click | `join` · `signup_brand` · `open_assisted` · `go_people` · `whatsapp` · `panel` | `hero` · `como` · `cierre` · `header` · `footer` |
| marcas | form_submit | `assisted` | `como` |

En el HTML: `data-track="target" data-section="section"` en cada enlace o botón; `track.tsx` delega los
clics en el `document`.

## Aviso al equipo — `src/lib/notify.ts` (server-only)

- Env: `CALLMEBOT_RECIPIENTS="573001112233:1234567,573004445566:7654321"` (teléfono:apikey, separados
  por coma). Si no existe → no hace nada.
- `GET https://api.callmebot.com/whatsapp.php?phone=<tel>&text=<urlencoded>&apikey=<key>`, timeout de 5 s
  por destinatario, en paralelo con `Promise.allSettled`; los errores se registran con `console.error`
  (aparecen en los logs de Vercel).
- Textos (sin datos personales del contacto):
  - `Icon · Subida asistida: {marca} ({ciudad}). Responder hoy → https://iconcolombia.com/admin?tab=solicitudes`
  - `Icon · Postulación de marca: {marca} ({n}ª vez). → https://iconcolombia.com/admin?tab=solicitudes`

## Env nuevas (`.env.example`)

`NEXT_PUBLIC_SITE_URL`, `LANDING_IP_SALT`, `CALLMEBOT_RECIPIENTS`.
