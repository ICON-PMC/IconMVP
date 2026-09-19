# Plan — Brand Registration + Admin Approval Queue

> **Special notes (apply to every task group)**
> - **Inclusive language:** the audience is not only women. Use "usuario" (never "usuaria") and neutral phrasing ("Te damos la bienvenida", "quien…") in UI copy, specs, code comments and emails. Recorded in `specs/constitution.md` §1.
> - **shadcn/ui is now installed** (`components.json`, `src/components/ui/`); new forms use it. Its tokens are mapped onto the Icon palette in `globals.css` (primary = forest, destructive = coral) — no parallel color system.

## Progress
- [x] 1. Database schema
- [x] 2. Brand signup UI — profile step
- [x] 3. Brand signup UI — first garment step
- [x] 4. Brand status banner
- [x] 5. Admin approval queue
- [x] 6. Email notifications
- [ ] 7. RLS + GRANT audit
- [ ] 8. QA pass

### Regression check (after group 5)
Against a production build (`next build` + `next start`) on local Supabase with `npm run db:import` sample data: `/feed` loads and hides a pending brand's published post/garment (also absent from search); `/marca/[slug]` renders for active brands and 404s for pending ones; `/prenda/[id]` and `/post/[id]` of a pending brand 404; `/admin`, `/admin/bulk` and `/admin?tab=marcas` return 200 for staff and redirect anon/regular users; regular signup still creates a plain `user` (no brand, not onboarded). No conflicts found. Build and lint pass.

### Cross-cutting changes made along the way
- **Gender-neutral language sweep:** "usuaria/usuarias" → "usuario/usuarios" (with article/adjective agreement) and "Bienvenida a Icon" → "Te damos la bienvenida a Icon", across `README.md`, `HANDOFF.md`, `TODO.md`, `.env.example`, `specs/`, `src/` (UI + comments) and SQL comments in existing migrations (comment-only edits; no schema change). "Dueña del proyecto" → "Responsable del proyecto".
- **shadcn/ui installed** via `npx shadcn@latest init` (style `base-nova`) + `input textarea select label`. Two fixes to what the generator produced: (1) `src/lib/utils.ts` re-exported `cn` from an unrelated npm package named `cn` — replaced with the standard `clsx` + `tailwind-merge` helper and removed that dependency; (2) the default neutral palette and `body` background override were replaced with tokens mapped to the Icon palette.
- **Lint error fixed:** `src/app/admin/page.tsx` called `Date.now()` during render (`react-hooks/purity`); moved into a module-level `daysAgoIso()` helper. `npm run lint` is now clean.

## Task groups

### 1. Database schema
- Review existing migrations `20260916000000_brand_role.sql` and `20260916010000_brand_self_serve.sql`; reconcile or extend as needed.
- Ensure `brands` has: `status enum('pending','active','rejected')`, `rejection_note text`, `submitted_at timestamptz`.
- Add `users.brand_id uuid references brands(id)` (nullable) so brand users are linked to their brand.
- Add RLS policy: a user with a linked `brand_id` can update their own brand row (and insert garments for it) while `status = pending | rejected`.
- Garments: ensure `status` column exists; pending-brand garments stay `pending` until brand is approved.
- Write/finalize migration file; apply to local with `supabase db reset` to verify.
- Update `src/lib/database.types.ts` by hand (no CLI gen) to reflect new columns.

**✅ Done — implementation notes** (`supabase/migrations/20260919000000_brand_registration.sql`)
- **Decisions (confirmed with product):**
  - `brands.owner_user_id` stays the source of truth (existing RLS/`is_brand_owner` use it). `users.brand_id` is added as a nullable mirror kept in sync by trigger `brands_sync_user_brand_id`; non-staff cannot write it directly.
  - Owners may edit their brand profile while `pending`, `rejected` **or `active`** (so the existing `/marca/panel` keeps working). This is broader than the original "only pending | rejected" wording; `validations.md` was updated to match. What they can never change is `status`, `is_active`, `is_verified` or `rejection_note`.
- **`brands`:** new `brand_status` enum + `status` (default `'active'` so staff-created brands are unaffected), `rejection_note`, `submitted_at`. Backfill: `is_active` → `active`, otherwise `pending`.
- **Triggers (replace app-level trust):**
  - `brands_protect_insert` — non-staff inserts are forced to `pending`, `is_active = false`, `is_verified = false`.
  - `brands_protect_curation_fields` (replaced) — non-staff can't change `status`/`is_active`/`is_verified`/`rejection_note`; the only allowed transition is `rejected → pending`, which clears the note and sets `submitted_at = now()`. `is_active` is derived from `status` (true only when `active`); approving clears `rejection_note`.
  - `garments_protect_status` — non-staff cannot set `status = 'published'` unless the brand is `active`. Closes a gap in the existing `garments_owner_all` policy.
  - `users_protect_role_field` (replaced) — also protects `users.brand_id` at trigger depth 1.
- **Bypass:** the brand/garment triggers only restrict authenticated end users (`auth.uid() is not null`); `service_role` and direct SQL can manage status.
- **No new GRANTs needed:** new columns inherit the existing table-level grants; public reads of `brands` are still gated by `is_active`.
- **Verified locally:** `supabase db reset` applies cleanly; SQL checks confirmed insert forced to pending, self-approve blocked, garment publish forced to pending, resubmit flow, staff approve/publish, and owner edit while active. `database.types.ts` updated (`tsc --noEmit` clean).
- **Not done here:** migration not yet applied to Supabase cloud (must happen before the code merges — see constitution §7.5). Task 5's approve action still has to batch-publish the brand's pending garments.

### 2. Brand signup UI — profile step
- Add "Soy una marca" option to `/signup` (or as a new step after account creation).
- Build `/onboarding/marca` (or `/signup/marca`) multi-step form:
  - Step 1: nombre comercial, bio (≤280), ciudad (select from `cities`), link (sitio/WhatsApp).
  - Step 2: foto de portada upload (reuse `uploadToR2` via `src/lib/upload.ts`).
- On submit: create `brands` row with `status = 'pending'`, link `users.brand_id`.
- Validate required fields inline in Spanish.

**✅ Done — implementation notes**
- **Entry point:** `/signup` now has a "Soy usuario / Soy una marca" toggle (`/signup?tipo=marca`). Brand mode sends a hidden `account_type=brand`; `signUp` then redirects to `/onboarding/marca` (regular flow still goes to `/onboarding`). Google OAuth is hidden in brand mode for now (its callback has no brand redirect). An existing user can reach the flow directly at `/onboarding/marca`.
- **Route:** `src/app/onboarding/marca/` — `page.tsx` (server, step indicator; `?paso=1|2`, defaults to 1 with no brand, 2 otherwise), `profile-form.tsx` + `cover-form.tsx` (client, `useActionState`, inline Spanish errors, bio counter, cover preview), `actions.ts`.
- **Step 1 (`saveBrandProfile`):** creates the `brands` row at this point (garments in step 3 need a `brand_id`) with a unique slug, `owner_user_id` = current user, and sets `users.role = 'brand'`. The insert trigger forces `status = 'pending'`, `is_active = false`. `submitted_at` stays **null** until final submission (group 3). Re-visiting step 1 edits the same brand. Link field accepts a website or a WhatsApp number (Colombian 10-digit numbers get `57` prefixed → `https://wa.me/…`); stored in `brands.store_url`.
- **Step 2 (`saveBrandCover`):** uploads via `uploadImageField` (sharp → WebP → R2), stores the **R2 key** in `brands.logo_url` (there is no separate cover column; `logo_url` is the brand's only image field). Rejects non-images and files >10 MB.
- **Shared logic:** `src/lib/brand-registration.ts` (`validateBrandProfile`, `normalizeBrandLink`, `slugify`).
- **shadcn/ui:** originally not installed, so the first version used `.glass-input` only. After the follow-up the forms use shadcn `Input`, `Textarea`, `Select`, `Label`, `Button` (styled with `.glass-input`).
- **Redirect:** step 2 now continues to step 3 (`?paso=3`, see group 3).
- **For group 5 (admin queue):** because the brand row exists after step 1, the queue must filter `status = 'pending' AND submitted_at IS NOT NULL` so half-finished signups don't appear.
- **Verified:** `tsc --noEmit` clean; `/signup?tipo=marca` renders toggle + hidden field and hides Google; `/onboarding/marca` redirects to login when signed out; step 1's DB path checked as an authenticated user (brand created `pending`, role → `brand`, `users.brand_id` synced). **Not verified:** the cover upload against real R2 (no R2 creds locally) and a full browser click-through.
- The pre-existing `npm run lint` error in `src/app/admin/page.tsx` was fixed afterwards (see cross-cutting changes).

### 3. Brand signup UI — first garment step
- Step 3 of the onboarding: add at least one garment.
- Reuse garment create form (título, precio, categoría, foto).
- "Submit for approval" button only enabled when ≥1 garment saved.
- On submit: set `brands.submitted_at = now()`.
- Show confirmation screen: "Tu perfil está en revisión."

**✅ Done — implementation notes**
- **Where:** step 3 lives at `/onboarding/marca?paso=3` (same route as steps 1–2; default step resumes where the brand left off: no cover → 2, cover → 3). Files: `garment-form.tsx` (client), `page.tsx`, `actions.ts` (`addOnboardingGarment`, `removeOnboardingGarment`, `submitBrandForReview`).
- **Garment form:** nombre, precio (COP, numbers only, `.`/spaces stripped), categoría (`tags` of type `category`, shadcn Select), foto (required, ≤10 MB, image only, preview) and an *optional* "enlace de compra" (`product_url`, useful because `/out/[garmentId]` redirects there). The existing panel/admin garment forms redirect and publish immediately, so a purpose-built action was used instead of reusing them.
- **Status:** garments are inserted `pending`/`source = 'brand'`; the `garments_protect_status` trigger would force `pending` anyway. No half-created garments: if the category tag or image upload fails, the garment row is deleted and an inline error is shown. Saved garments are listed with thumbnail/price and can be removed ("Quitar") before submitting (removed garments' R2 objects are not cleaned up).
- **Submit:** "Enviar para aprobación" is disabled until ≥1 garment is saved and is re-checked server-side (`submitBrandForReview` counts garments); it sets `brands.submitted_at = now()` (allowed by the trigger while `pending`). Brand stays `pending`.
- **Confirmation:** once `submitted_at` is set and the brand is `pending`, `/onboarding/marca` shows "Tu perfil está en revisión. Te avisaremos por correo cuando sea aprobado." with a link to `/marca/panel`. `active`/`rejected` brands are redirected to `/marca/panel` (banner is group 4).
- **Verified:** `tsc` + `lint` clean; as an authenticated user under RLS: garment/tag/image insert, count, `submitted_at` update, attempt to self-publish stays `pending`, delete works; pages render for a signed-in brand (step 3 shows the disabled submit + hint, steps 1/2 render). **Not verified:** actual R2 uploads (no credentials locally) and the browser click-through.

### 4. Brand status banner
- In `/marca/panel` (or `/settings` fallback): detect `users.brand_id` and load `brands.status`.
- Render banner:
  - `pending` → yellow, "Tu marca está pendiente de aprobación."
  - `rejected` → red, "Tu marca fue rechazada. {rejection_note}" + "Editar y reenviar" button.
  - `active` → green, "Tu marca está activa."
- Rejected brands can edit profile fields and resubmit (sets `status = 'pending'` again, clears `rejection_note`).

**✅ Done — implementation notes**
- **Component:** `src/components/brand-status-banner.tsx` (server component, `role="status"`), rendered at the top of `/marca/panel`. It replaces the old inline "En revisión" badge. Only brand owners can reach the panel; a regular user (no brand) sees the "Conecta tu marca" screen and no banner.
- **States:** `pending` + submitted → yellow "Tu marca está pendiente de aprobación."; `rejected` → red "Tu marca fue rechazada. {rejection_note}" + **Editar y reenviar**; `active` → green "Tu marca está activa."
- **Extra state (not in the spec):** `pending` with `submitted_at` null (onboarding never finished) shows a yellow "Falta enviar tu marca a revisión." + **Continuar registro** instead of claiming it is awaiting approval, which would be false.
- **Lookup:** the brand is loaded through `getMyBrand()` (`brands.owner_user_id`, the source of truth); `users.brand_id` is its trigger-synced mirror, so results are identical.
- **Edit & resubmit:** "Editar y reenviar" → `/onboarding/marca?paso=1`. The onboarding route now lets a `rejected` brand back in (shows the rejection note, all three steps editable, final button reads "Reenviar para aprobación"). `submitBrandForReview` sets `status = 'pending'` for rejected brands; the existing trigger clears `rejection_note` and resets `submitted_at`. `active` brands are redirected to the panel.
- **Design tokens:** added `--color-honey` / `--color-honey-soft` to `globals.css` for the yellow state (no existing token fit); red reuses `coral`, green reuses `leaf-soft`/`forest`.
- **Verified locally:** rendered `/marca/panel` for brands in each state (unsent, pending, active, rejected) and for a regular user; rejected → onboarding shows the note; resubmit (as the owner, under RLS) leaves `status = pending`, `rejection_note = null`, fresh `submitted_at`. `tsc` + `lint` clean. Not verified: browser click-through.

### 5. Admin approval queue
- Add "Marcas pendientes" tab to `/admin` with count badge (number of `status = 'pending'` brands).
- Table/card list: name, city, bio, cover photo thumbnail, garment count, `submitted_at`.
- Approve action: server action sets `brands.status = 'active'`, `brands.is_active = true`, batch-publishes brand's pending garments.
- Reject action: modal for optional note → server action sets `brands.status = 'rejected'`, stores `rejection_note`.
- Both actions protected by `requireStaff()`.

**✅ Done — implementation notes**
- **Migration `20260919010000_brand_review_rpcs.sql`:** `approve_brand(uuid)` and `reject_brand(uuid, text)`, `security definer`, staff-only (`is_staff()` → error `42501` otherwise), `EXECUTE` revoked from `public`/`anon` and granted to `authenticated`. Approve sets `status = 'active'`, `is_active = true`, clears the note **and publishes the brand's `pending` garments in the same transaction** (so a brand can never be active with unpublished garments). Reject sets `status = 'rejected'`, `is_active = false` and stores the trimmed note (`null` if empty); garments stay `pending`. Both only act on `status = 'pending'` and raise a Spanish error otherwise (double clicks / two staff members). Added to `database.types.ts`. **Must be applied to Supabase cloud before the code merges.**
- **Server actions** (`src/app/admin/actions.ts`): `approveBrand(brandId)` / `rejectBrand(brandId, note)` return `{ ok, error }` instead of using `requireStaff()`'s redirect, so a non-staff caller gets an error result, never a 500. Group 6 (emails) hooks in here after a successful RPC.
- **UI:** `/admin?tab=marcas` ("Marcas pendientes", link-based tab with a count badge; the badge shows on both tabs). The queue tab returns early, so the heavy metrics queries only run on the default tab. Files: `admin-tabs.tsx`, `pending-brands.tsx` (server: name, city, bio, store link, cover thumbnail, submitted date, garment count + thumbnails/titles so staff can judge the catalog), `review-actions.tsx` (client: Aprobar, and a shadcn `Dialog` for Rechazar with an optional note, errors inline). Added shadcn `dialog` + `badge`.
- **Queue filter:** `status = 'pending' AND submitted_at IS NOT NULL`, oldest first, so half-finished signups don't appear; the badge count uses the same filter.
- **Verified locally** (curator + regular user, real RLS): non-staff calling either RPC → `42501`; staff approve → brand `active`/`is_active`, both garments `published` with `published_at`; approving twice → "La marca ya no está pendiente de revisión."; staff reject with a padded note → stored trimmed, brand `rejected`, garments still `pending`; anon can read the approved brand but not the rejected one; a regular user visiting `/admin` is redirected; queue lists pending brands, hides half-finished ones. `tsc` + `lint` clean. Not verified: the Rechazar dialog / buttons in a real browser.
- **Docs correction:** the local seed does *not* create the accounts listed in `HANDOFF.md` (`admin@icon.co`, etc.); create a staff user by signing up and setting `role` in SQL.

### 6. Email notifications
- On approve: send email to brand's `auth.users.email` — subject "¡Tu marca fue aprobada en Icon!", body in Spanish with link to brand panel.
- On reject: send email — subject "Tu solicitud en Icon necesita ajustes", body includes `rejection_note` and link to edit profile.
- Use Supabase SMTP (already configured in cloud project). Trigger via server action using `supabase.auth.admin.sendRawEmail` or a Supabase Edge Function.
- Test with Mailpit on local (`:54324`).

**✅ Done — implementation notes**
- **Decision (confirmed with product):** the plan's `supabase.auth.admin.sendRawEmail` does not exist in supabase-js, and Supabase's SMTP only sends *auth* emails (confirmation/reset). Emails are sent with **nodemailer over SMTP** from the server action instead. No new vendor: in the cloud, reuse the same SMTP credentials the Supabase project already has (Auth → SMTP Settings).
- **Files:** `src/lib/email.ts` (`sendEmail`, reads `SMTP_HOST/PORT/USER/PASS` + `EMAIL_FROM`; if unset it logs and returns an error instead of throwing), `src/lib/brand-emails.ts` (Spanish templates, HTML-escaped, plain-text + HTML), wiring in `reviewBrand()` in `src/app/admin/actions.ts`.
- **Recipient without service-role:** `approve_brand` / `reject_brand` now return `(brand_name, owner_email)` (edited in place in `20260919010000_brand_review_rpcs.sql`, which had not been deployed yet; `database.types.ts` updated), because staff cannot read another user's `users` row. Emails go **only** to the brand's owner — never to staff or regular users.
- **Content:** approve → "¡Tu marca fue aprobada en Icon!" with a link to `/marca/panel`; reject → "Tu solicitud en Icon necesita ajustes" including the staff note (if any) and a link to `/onboarding/marca?paso=1`. Links use `NEXT_PUBLIC_SITE_URL` or, if unset, the request origin.
- **Failure handling:** the email is sent after the RPC succeeds; if it fails the decision stands and the action returns `emailSent: false`. The queue then shows a yellow notice ("…pero no pudimos enviar el correo. Avísale por otro medio.") via `?aviso=`; on success a green confirmation.
- **Local testing:** `supabase/config.toml` now exposes Mailpit SMTP (`smtp_port = 54325`; restart Supabase after pulling). `.env.local`: `SMTP_HOST=127.0.0.1`, `SMTP_PORT=54325`, `EMAIL_FROM=…`. Inbox: http://127.0.0.1:54324.
- **Deploy checklist (cloud):** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (a sender the SMTP provider allows) and ideally `NEXT_PUBLIC_SITE_URL` in Vercel; without them approvals still work but show the "no pudimos enviar el correo" notice.
- **Verified locally** (temporary route calling the real server actions with real sessions, since removed): regular user → permission error; staff approve → brand email in Mailpit with panel link; staff reject with a note containing HTML → email with the note, escaped in the HTML part; rejecting twice → "ya no está pendiente"; no messages to staff/regular accounts. **Not verified:** the SMTP-unset/failure notice path, real SMTP delivery in the cloud, and the queue notices in a browser.

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
