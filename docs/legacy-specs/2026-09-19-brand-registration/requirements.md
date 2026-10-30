# Requirements — Brand Registration + Admin Approval Queue

## Scope decisions

### In scope
- Brand signup flow: registration form → profile setup → upload ≥1 garment → submit for approval
- Admin approval queue: review pending brands, approve or reject with optional note
- Approval notification: in-app status banner in brand panel (transactional email **deferred** to roadmap Fase 2 — needs a custom domain)

### Out of scope (separate branch)
- Brand panel (manage garments, post outfits): `src/app/marca/panel/` — future branch
- Instagram import (OAuth + draft posts): listed in roadmap but not this branch
- Brand following, brand analytics

---

## User stories

### Brand registrant

1. A brand visits `/signup` and chooses "Soy una marca" during registration.
2. They complete a profile form: nombre comercial, bio (≤280 chars), ciudad, foto de portada, link (sitio web o WhatsApp).
3. They add at least one garment to their catalog (título, precio, categoría, foto). Without this, the "Submit for approval" button is disabled.
4. They submit. Their account enters `status = pending`. They see a confirmation screen: "Tu perfil está en revisión. Vuelve a ingresar a tu panel para ver el estado de tu solicitud."
5. They can log back in and see a status banner: "Tu marca está pendiente de aprobación" (yellow) or "Tu marca fue rechazada: {note}" (red) or "Tu marca está activa" (green).

### Admin

1. Admin sees a "Marcas pendientes" tab in `/admin` with a count badge.
2. Each pending brand shows: name, city, bio, cover photo, garments submitted, submission date.
3. Admin can Approve → brand.status = 'active', brand and all its content become visible in feed.
4. Admin can Reject → brand.status = 'rejected', optional note stored; the brand sees it in its panel banner (email deferred).

---

## Scope constraints

- **Profile + 1 garment required** before submission (not a post). The garment enters `status = pending` alongside the brand; it becomes `published` only when the brand is approved.
- **Approval is all-or-nothing** for the initial submission. Once approved, future garments/posts publish without review.
- **Rejection is reversible**: a rejected brand can edit their profile and resubmit (status → pending again).
- **Curators can also approve** (role: curator or admin).
- Brand visibility rule: `brands.is_active = true` only when `status = 'active'`. The existing RLS filter `brands.is_active` already gates public reads — no new policy needed for that.

---

## Data model notes

- `brands` table needs: `status` enum (`pending | active | rejected`), `rejection_note text`, `submitted_at timestamptz`.
- `users` needs a way to link to a brand (`brand_id uuid → brands.id`) so a brand user can only see/edit their own brand.
- Existing migrations `20260916000000_brand_role.sql` and `20260916010000_brand_self_serve.sql` may already cover some of this — review before writing new migrations.
- Garments belonging to a pending brand stay `status = 'pending'` until the brand is approved (batch update on approval).
- Email notification: **deferred** (see plan group 6 and `specs/roadmap.md` Fase 2). Brands learn the outcome from the status banner in their panel.

---

## UX / design constraints

- Estética glass/tropical: reuse existing tokens (`--color-forest/leaf/coral/blush/cream`) and `.glass` / `GlassCard` components.
- shadcn/ui for form components (Input, Select, Textarea, Button) — already in the stack.
- Mobile-first: the brand signup flow must work on phone (brands will use it from WhatsApp links).
- Error messages in Spanish (inline, not toast-only).

---

## Pillar alignment (every decision should reinforce ≥1)

| Decision | Pillar |
|---|---|
| Approval queue before visibility | Curaduría/estética — only vetted brands appear |
| Garment required at signup | Intención — brands must have real product before joining |
| Rejection with note | Curaduría/estética — clear feedback preserves quality bar |
| Local brand only (city required) | Local/independiente |
