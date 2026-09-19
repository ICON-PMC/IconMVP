# Validations — Fase 0: Social Actions + Infrastructure Polish

All checks must pass before merging `feat/fase0-social-infra` → `main`.

---

## Group 1 — Schema

- [ ] Migration applies from scratch: `supabase db reset` completes without errors.
- [ ] `brand_follows(user_id, brand_id)` has a compound PK; FK cascades delete correctly.
- [ ] `post_likes(user_id, post_id)` has a compound PK; FK cascades delete correctly.
- [ ] Following a brand increments `brands.follower_count`; unfollowing decrements it. Count never goes below 0.
- [ ] Liking a post increments `posts.like_count` and `posts.popularity`. Unliking decrements `like_count` (popularity stays — intentional, matches existing click pattern).
- [ ] `users.storage_bytes_used` and `brands.storage_bytes_used` exist as `bigint not null default 0`.
- [ ] `check_storage_quota` DB function exists and returns correct `{ allowed, used_bytes, limit_bytes }` for both user (50 MB limit) and brand (300 MB limit).
- [ ] `post_feed` view includes `like_count`; existing feed queries still work.
- [ ] `database.types.ts` updated for all new columns, tables, and the updated view.
- [ ] A user cannot follow/unlike on behalf of another user (RLS blocks it).

---

## Group 2 — shadcn/ui

- [ ] `components.json` exists; `src/components/ui/` directory is populated with installed components.
- [ ] `npm run build` passes — no TypeScript errors from shadcn imports.
- [ ] Login form uses `shadcn/Input` and `shadcn/Button`; visually equivalent to before.
- [ ] Signup form uses shadcn components; visually equivalent.
- [ ] Admin create forms use shadcn form components.
- [ ] Glass/tropical tokens in `globals.css` are untouched (grep for `--color-forest` — still present).
- [ ] No existing component broke: spot-check `/feed`, `/post/[id]`, `/marca/[slug]` in the browser.

---

## Group 3 — Errores en español + 404

- [ ] `/login` with wrong credentials shows "Correo o contraseña incorrectos." inline (not a browser alert, not English).
- [ ] `/signup` with an existing email shows "Este correo ya está registrado." inline.
- [ ] `/signup` with a short password shows the length message inline.
- [ ] `/marca/fake-slug` renders the custom `not-found.tsx` with a glass card and a link to `/feed`.
- [ ] `/prenda/00000000-0000-0000-0000-000000000000` renders its custom 404 page.
- [ ] `/post/00000000-0000-0000-0000-000000000000` renders its custom 404 page.
- [ ] None of the 404 pages crash or show a Next.js default error boundary.

---

## Group 4 — Follow brand

- [ ] "Seguir" button appears on `/marca/[slug]` for logged-in users.
- [ ] Clicking "Seguir" changes button to "Siguiendo" instantly (optimistic), then persists.
- [ ] Clicking "Siguiendo" unfollows instantly (optimistic), then persists.
- [ ] Follower count shown next to the button updates to reflect the follow/unfollow.
- [ ] Unauthenticated user sees the follower count but the button links to `/login`.
- [ ] Server action rejects unauthenticated requests (returns error, not 500).
- [ ] Unfollowing a brand with 0 followers doesn't produce a negative count (DB constraint).

---

## Group 5 — Like post

- [ ] Heart icon appears on post cards in the feed and on `/post/[id]`.
- [ ] Clicking the heart fills it instantly (optimistic) and persists.
- [ ] Clicking a filled heart unfills it (optimistic) and persists.
- [ ] Like count next to the heart updates correctly.
- [ ] Unauthenticated user sees counts; clicking the heart links to `/login`.
- [ ] Liking a post increments `posts.popularity` in the DB (verify via admin metrics or direct query).
- [ ] Server action rejects unauthenticated requests.

---

## Group 6 — Storage quotas

- [ ] `src/lib/storage-quota.ts` exports `checkStorageQuota` with the contracted signature.
- [ ] Uploading an image as a regular user updates `users.storage_bytes_used`.
- [ ] Uploading an image as a brand updates `brands.storage_bytes_used`.
- [ ] Uploading beyond the limit returns the Spanish error message and does NOT write to R2.
- [ ] The storage bar in brand panel and `/settings` shows the correct percentage.
- [ ] Warning state (yellow) appears when usage ≥ 80%.
- [ ] Full state (red) appears when at limit and upload is blocked.
- [ ] `feat/brand-registration` stub (`checkStorageQuota` always returning `{ allowed: true }`) is replaced by the real implementation after this branch merges — verified by checking the exported function in `src/lib/storage-quota.ts` is not the stub.

---

## Cross-branch contract validation

- [ ] `src/lib/storage-quota.ts` exists with the exact function signature agreed in requirements.md.
- [ ] `database.types.ts` reconciliation: after merging both branches, TypeScript compiles cleanly with both `brand_id` (from `feat/brand-registration`) and `storage_bytes_used`, `follower_count`, `like_count` (from this branch) present.

---

## Regression checks

- [ ] `npm run build` passes with zero TypeScript errors.
- [ ] `npm run lint` passes.
- [ ] Feed loads; `post_feed` view returns `like_count` without breaking existing fields.
- [ ] Existing admin routes work; bulk import still functions.
- [ ] Existing brand/garment/post pages render without errors.
- [ ] Follows and likes don't appear for unauthenticated users as interactive elements.

---

## Merge criteria

All checkboxes above are checked or explicitly deferred with a written note.
The `checkStorageQuota` contract function is exported and matches the agreed signature.
No `TODO` without a linked follow-up in the specs or roadmap.
