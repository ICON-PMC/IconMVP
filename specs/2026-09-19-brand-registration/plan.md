# Plan — Brand Registration + Admin Approval Queue

## Task groups

### 1. Database schema
- Review existing migrations `20260916000000_brand_role.sql` and `20260916010000_brand_self_serve.sql`; reconcile or extend as needed.
- Ensure `brands` has: `status enum('pending','active','rejected')`, `rejection_note text`, `submitted_at timestamptz`.
- Add `users.brand_id uuid references brands(id)` (nullable) so brand users are linked to their brand.
- Add RLS policy: a user with a linked `brand_id` can update their own brand row (and insert garments for it) while `status = pending | rejected`.
- Garments: ensure `status` column exists; pending-brand garments stay `pending` until brand is approved.
- Write/finalize migration file; apply to local with `supabase db reset` to verify.
- Update `src/lib/database.types.ts` by hand (no CLI gen) to reflect new columns.

### 2. Brand signup UI — profile step
- Add "Soy una marca" option to `/signup` (or as a new step after account creation).
- Build `/onboarding/marca` (or `/signup/marca`) multi-step form:
  - Step 1: nombre comercial, bio (≤280), ciudad (select from `cities`), link (sitio/WhatsApp).
  - Step 2: foto de portada upload (reuse `uploadToR2` via `src/lib/upload.ts`).
- On submit: create `brands` row with `status = 'pending'`, link `users.brand_id`.
- Validate required fields inline in Spanish.

### 3. Brand signup UI — first garment step
- Step 3 of the onboarding: add at least one garment.
- Reuse garment create form (título, precio, categoría, foto).
- "Submit for approval" button only enabled when ≥1 garment saved.
- On submit: set `brands.submitted_at = now()`.
- Show confirmation screen: "Tu perfil está en revisión."

### 4. Brand status banner
- In `/marca/panel` (or `/settings` fallback): detect `users.brand_id` and load `brands.status`.
- Render banner:
  - `pending` → yellow, "Tu marca está pendiente de aprobación."
  - `rejected` → red, "Tu marca fue rechazada. {rejection_note}" + "Editar y reenviar" button.
  - `active` → green, "Tu marca está activa."
- Rejected brands can edit profile fields and resubmit (sets `status = 'pending'` again, clears `rejection_note`).

### 5. Admin approval queue
- Add "Marcas pendientes" tab to `/admin` with count badge (number of `status = 'pending'` brands).
- Table/card list: name, city, bio, cover photo thumbnail, garment count, `submitted_at`.
- Approve action: server action sets `brands.status = 'active'`, `brands.is_active = true`, batch-publishes brand's pending garments.
- Reject action: modal for optional note → server action sets `brands.status = 'rejected'`, stores `rejection_note`.
- Both actions protected by `requireStaff()`.

### 6. Email notifications
- On approve: send email to brand's `auth.users.email` — subject "¡Tu marca fue aprobada en Icon!", body in Spanish with link to brand panel.
- On reject: send email — subject "Tu solicitud en Icon necesita ajustes", body includes `rejection_note` and link to edit profile.
- Use Supabase SMTP (already configured in cloud project). Trigger via server action using `supabase.auth.admin.sendRawEmail` or a Supabase Edge Function.
- Test with Mailpit on local (`:54324`).

### 7. RLS + GRANT audit
- Run through every new/modified table and confirm `GRANT SELECT/INSERT/UPDATE` to the right roles.
- Confirm public reads of `brands` still require `is_active = true` (existing policy).
- Confirm brand users cannot approve/reject themselves.

### 8. QA pass
- Local: complete full flow as a new brand user (signup → garment → submit → admin approve → email in Mailpit → banner green).
- Test rejection + re-submit flow.
- Verify public feed does NOT show pending/rejected brands.
- Confirm admin cannot be bypassed (direct DB row edit still needs RLS).

---

## Open questions / deferred

- `/marca/panel` full dashboard (garment CRUD, post creation) — out of scope here, separate branch.
- Instagram OAuth import — roadmap Fase 0 but separate branch.
- Storage quota enforcement (50 MB user / 300 MB brand) — can be added in this branch or a follow-up; the tech-stack spec calls for it in Fase 0.
