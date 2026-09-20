# Validations — Brand Registration + Admin Approval Queue

These checks must all pass before merging `feat/brand-registration` → `dev`.

---

## Database

- [x] Migration applies cleanly from scratch: `supabase db reset` completes without errors.
- [x] `brands.status` is constrained to `('pending', 'active', 'rejected')`.
- [x] `users.brand_id` foreign key exists and is nullable (regular users unaffected).
- [x] A brand user can update their own `brands` row (pending, rejected or active) but never its `status`, `is_active`, `is_verified` or `rejection_note` (only `rejected → pending` resubmit is allowed).
- [x] A brand user cannot set their own `brands.status` to `'active'` via direct update (RLS blocks it).
- [x] Pending brand's garments have `status = 'pending'`; after admin approval they become `'published'`.
- [x] `database.types.ts` is in sync with the new columns (manual update verified by TypeScript compile).

---

## Brand signup flow

- [x] `/signup` offers a "Soy una marca" path.
- [x] Submitting the profile form without all required fields shows inline errors in Spanish.
- [x] Uploading a cover photo succeeds and stores an R2 key (not a blob URL). *(confirmed in the cloud preview)*
- [x] "Enviar para aprobación" button is disabled until ≥1 garment is saved.
- [x] After submission: `brands.status = 'pending'`, `brands.submitted_at` is set, `users.brand_id` is linked.
- [x] Confirmation screen appears with the correct message in Spanish.
- [x] A rejected brand can edit their profile and resubmit → status returns to `pending`, `rejection_note` is cleared.

---

## Brand status banner

- [x] A pending brand logging into their panel sees the yellow "pendiente" banner.
- [x] A rejected brand sees the red banner with the rejection note and an "Editar y reenviar" button.
- [x] An active brand sees the green "activa" banner.
- [x] A regular user (no `brand_id`) does not see any brand banner.

---

## Admin approval queue

- [x] "Marcas pendientes" tab shows only brands with `status = 'pending'`.
- [x] Count badge on the tab matches the number of rows returned.
- [x] Approve action: brand status → `active`, `is_active = true`, all pending garments → `published`.
- [x] Reject action: modal accepts optional note; rejection stored; status → `rejected`.
- [x] Both actions return an error (not 500) if called by a non-staff user.
- [x] After approval, the brand appears in the public feed and `/marca/[slug]` is accessible.
- [x] After rejection, the brand does NOT appear in the public feed.

---

## Email notifications

**Deferred** to a later phase (roadmap Fase 2, "Correo transaccional"): no custom domain yet for a verified sender. Not required for merge; the brand sees the outcome in its status banner instead.

- [ ] ~~Approval email is received at the brand's address.~~ (deferred)
- [ ] ~~Approval email is in Spanish and contains a link to the brand panel.~~ (deferred)
- [ ] ~~Rejection email includes the admin's note (if provided).~~ (deferred)
- [ ] ~~No email is sent to regular users or admins when a brand is approved/rejected.~~ (deferred)

---

## Regression checks

- [x] `npm run build` passes with zero TypeScript errors.
- [x] `npm run lint` passes.
- [x] Public feed (`/feed`) still loads and shows only active brands.
- [x] Existing admin routes (`/admin`, `/admin/bulk`) still work for staff users.
- [x] Regular signup (non-brand) flow is unaffected.
- [x] Existing brand pages (`/marca/[slug]`) still render for active brands.

---

## Merge criteria

All checkboxes above are checked, or explicitly deferred with a note explaining why it's safe to defer.

**Status:** all checked except the email notifications, deferred (see that section). Extra check added during the RLS audit: pending brands cannot publish posts (`20260919020000_protect_post_status.sql`) — apply to the cloud before merging.
No `TODO` or `FIXME` comments in new files without a linked follow-up task.
