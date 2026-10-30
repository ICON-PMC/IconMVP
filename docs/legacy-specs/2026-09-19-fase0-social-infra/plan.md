# Plan — Fase 0: Social Actions + Infrastructure Polish

Task groups are ordered by dependency. Groups 1–3 are fully independent of each other
and can be worked on in parallel. Groups 4–5 depend on Group 1 schema.

---

## Group 1 — Database schema (no UI dependency)
*Unblocked from day 1. Land this first so Groups 4 and 5 can start.*

- **1a. `brand_follows` table**
  - Columns: `user_id uuid`, `brand_id uuid`, `created_at timestamptz default now()`
  - PK: `(user_id, brand_id)`
  - FK: `user_id → users.id`, `brand_id → brands.id` (cascade delete)
  - RLS: authenticated users can insert/delete their own rows; anyone can read counts.
  - Add `brands.follower_count int default 0`; trigger increments/decrements on insert/delete of `brand_follows`.

- **1b. `post_likes` table**
  - Columns: `user_id uuid`, `post_id uuid`, `created_at timestamptz default now()`
  - PK: `(user_id, post_id)`
  - FK: `user_id → users.id`, `post_id → posts.id` (cascade delete)
  - RLS: authenticated users can insert/delete their own rows; anyone can read counts.
  - Add `posts.like_count int default 0`; trigger increments/decrements on insert/delete.
  - Trigger also increments `posts.popularity` by 1 on like (same pattern as outbound clicks).

- **1c. Storage tracking**
  - Add `storage_bytes_used bigint not null default 0` to `users` and `brands`.
  - Create function `check_storage_quota(p_account_id uuid, p_account_type text, p_bytes bigint) returns jsonb` — returns `{ allowed, used_bytes, limit_bytes }`. Initial logic: `allowed = (used + p_bytes) <= limit`.
  - Limits hardcoded in function: user = 52428800 (50 MB), brand = 314572800 (300 MB).
  - Create `src/lib/storage-quota.ts` stub (calls the DB function or returns `{ allowed: true }` until DB function exists locally).

- **1d. Expose in `post_feed` view**
  - Add `like_count` to the `post_feed` view so feed cards can show it without a second query.
  - Update `database.types.ts` for all new columns and the `post_feed` view row type.

- **Contract note:** `feat/brand-registration` calls `checkStorageQuota` from `src/lib/storage-quota.ts`. This group ships the real implementation; until then the stub returns `{ allowed: true }` unconditionally.

---

## Group 2 — shadcn/ui setup (no schema dependency)
*Unblocked from day 1. Can be done in a single sitting.*

- Run `npx shadcn@latest init` — choose the existing `globals.css`, don't overwrite custom tokens.
- Install components used in existing forms: `input`, `button`, `select`, `textarea`, `dialog`, `label`.
- Migrate `/login` form: replace raw `<input>`/`<button>` with `shadcn/Input` and `shadcn/Button`.
- Migrate `/signup` form: same.
- Migrate admin create forms (`/admin/brands/new`, `/admin/garments/new`, `/admin/posts/new`) to shadcn form components.
- Smoke-test: `npm run build` passes, visual diff acceptable.
- **Do not** change the glass utilities or any token in `globals.css`. Add shadcn variables in a separate block.

---

## Group 3 — Errores en español + páginas 404 (no schema dependency)
*Unblocked from day 1. Small, isolated changes.*

- **3a. Spanish auth errors**
  - In `src/app/auth/actions.ts`: map Supabase error codes to Spanish strings.
    - `invalid_credentials` → "Correo o contraseña incorrectos."
    - `email_address_already_used` → "Este correo ya está registrado."
    - `weak_password` → "La contraseña debe tener al menos 6 caracteres."
    - Generic fallback: "Ocurrió un error. Inténtalo de nuevo."
  - Return the Spanish string as the `error` field in the server action result; form components display it inline.
  - No toast library needed — inline `<p className="text-red-600 text-sm">` is fine.

- **3b. 404 pages**
  - `src/app/marca/[slug]/not-found.tsx`
  - `src/app/prenda/[id]/not-found.tsx`
  - `src/app/post/[id]/not-found.tsx`
  - Each: centered card with glass style, Spanish message, link to `/feed`.
  - No new images or external assets — text only.
  - Existing `notFound()` calls already trigger these files; no logic changes needed.

---

## Group 4 — Follow brand UI (depends on Group 1)
*Start after `brand_follows` table and `brands.follower_count` are in the DB.*

- **4a. Server actions** in `src/app/marca/[slug]/actions.ts`:
  - `followBrand(brandId)` — inserts into `brand_follows`, revalidates path.
  - `unfollowBrand(brandId)` — deletes from `brand_follows`, revalidates path.
  - Both require auth; unauthenticated calls return an error.

- **4b. `FollowButton` component** `src/components/follow-button.tsx`:
  - Props: `brandId`, `initialFollowing: bool`, `initialCount: number`.
  - Optimistic UI: toggle `following` state immediately, call server action, rollback on error.
  - "Seguir" / "Siguiendo" label; filled heart or user-plus icon from `lucide-react`.
  - Unauthenticated: renders as a link to `/login?next=/marca/[slug]`.

- **4c. Integrate into `/marca/[slug]`**
  - Load `brand_follows` row for current user (or null if not logged in) alongside the brand query.
  - Display `brands.follower_count` next to the button ("234 seguidores").

---

## Group 5 — Like post UI (depends on Group 1)
*Start after `post_likes` table and `posts.like_count` are in the DB.*

- **5a. Server actions** in `src/app/post/[id]/actions.ts` (new file):
  - `likePost(postId)` / `unlikePost(postId)`.
  - Both require auth; unauthenticated calls return an error.

- **5b. `LikeButton` component** `src/components/like-button.tsx`:
  - Props: `postId`, `initialLiked: bool`, `initialCount: number`.
  - Optimistic UI: same pattern as `FollowButton`.
  - Heart icon from `lucide-react`; filled when liked.
  - Unauthenticated: renders as link to `/login?next=/post/[id]`.

- **5c. Integrate into feed cards and `/post/[id]`**
  - `post_feed` view now includes `like_count` — no extra query.
  - Batch-load current user's liked post IDs on the feed page (single query: `select post_id from post_likes where user_id = $1 and post_id = any($2)`).
  - Display on `PostCard` and on the detail page.

---

## Group 6 — Storage quota enforcement (depends on Group 1)
*Start after `check_storage_quota` DB function exists.*

- **6a. Real `checkStorageQuota` implementation** in `src/lib/storage-quota.ts`:
  - Calls the DB function via `supabase.rpc('check_storage_quota', {...})`.
  - Returns `{ allowed, usedBytes, limitBytes }`.

- **6b. Hook into `uploadToR2`** in `src/lib/upload.ts`:
  - Before calling `uploadToR2`, call `checkStorageQuota`.
  - If `!allowed`: throw with Spanish message "Has alcanzado el límite de almacenamiento."
  - If `allowed`: after successful upload, increment `storage_bytes_used` by actual file size.

- **6c. Warning UI**
  - In brand panel (`/marca/panel`) and user `/settings`: show a storage bar.
  - Below 80%: no indicator.
  - 80–99%: yellow warning "Estás usando el X% de tu almacenamiento."
  - 100%: red "Límite alcanzado. No puedes subir más archivos."
  - A small `StorageBar` component `src/components/storage-bar.tsx`.

---

## Merge order (recommendation)

1. Land Group 1 first (schema is the foundation for Groups 4, 5, 6).
2. Groups 2 and 3 can merge any time — they're independent.
3. Groups 4, 5, 6 can merge in any order once Group 1 is in.
4. After this branch merges to `main`, the storage quota stub in `feat/brand-registration` becomes live enforcement automatically.
