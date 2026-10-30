# Requirements — Fase 0: Social Actions + Infrastructure Polish

## Scope

This branch covers all remaining Fase 0 items not in `feat/brand-registration`:

| Item | Status |
|---|---|
| Seguir marcas | New |
| Dar like a posts | New |
| Cuotas de almacenamiento R2 | New |
| shadcn/ui integration | New |
| Error messages in Spanish | New |
| Páginas 404 mínimas | New |

**Does NOT include:** brand registration flow, admin approval queue, Instagram import — those live in `feat/brand-registration`.

---

## Parallel development contract with `feat/brand-registration`

Both branches land on `main` independently. To avoid blocking each other:

### Storage quota contract

`feat/brand-registration` uploads images (cover photo + garments). This branch owns quota enforcement. The contract is a single function in `src/lib/storage-quota.ts`:

```ts
// THIS BRANCH owns the real implementation.
// feat/brand-registration must call this before every upload and respect the result.
export async function checkStorageQuota(
  accountId: string,
  accountType: 'user' | 'brand',
  bytesToAdd: number
): Promise<{ allowed: boolean; usedBytes: number; limitBytes: number }>
```

- **This branch** ships the real implementation + DB tracking.
- **`feat/brand-registration`** calls `checkStorageQuota` but the stub (always `{ allowed: true }`) is already in place until this branch merges.
- After both branches merge, the enforcement activates automatically — no second pass needed.

### Schema contract on shared tables

| Table | `feat/brand-registration` adds | This branch adds | Conflict? |
|---|---|---|---|
| `brands` | `status`, `rejection_note`, `submitted_at` | `follower_count` (trigger-maintained) | None |
| `users` | `brand_id` | `storage_bytes_used` | None |
| `posts` | — | `like_count` (trigger-maintained) | None |

Both branches touch `database.types.ts`. Whoever merges second must reconcile the types manually — this is expected and documented.

---

## User stories

### Follow a brand

- Any logged-in user sees a "Seguir" button on `/marca/[slug]`.
- Clicking it creates a `brand_follows` row; button changes to "Siguiendo" with a fill state.
- Clicking "Siguiendo" unfollows (deletes the row).
- Follower count is displayed publicly on the brand page ("234 seguidores").
- Unauthenticated users see the count but the button redirects to `/login` on click.

### Like a post

- Any logged-in user sees a heart icon on post cards (feed) and on `/post/[id]`.
- Clicking likes the post; heart fills. Clicking again removes the like.
- Like count is shown next to the heart (public, visible without login).
- Liking a post increments `posts.popularity` by 1 (same trigger pattern as outbound clicks).
- Unauthenticated users see counts; clicking the heart redirects to `/login`.

### Storage quotas

- Every upload (image or file) passes through `checkStorageQuota` before writing to R2.
- At 80% of the limit, the UI shows a warning in the brand panel / user settings.
- At 100%, the upload is blocked with a Spanish error: "Has alcanzado el límite de almacenamiento (300 MB). Contacta a soporte para ampliar tu cuota."
- Quotas: 50 MB per user account, 300 MB per brand account.
- Tracking: `users.storage_bytes_used` and `brands.storage_bytes_used` updated after each successful upload.

### shadcn/ui

- `shadcn@latest init` run, `components.json` committed.
- Existing login, signup, and admin forms migrated to `Input`, `Button`, `Select`, `Dialog` from shadcn.
- No visual regression: existing glass/tropical tokens and `.glass` utilities are preserved alongside shadcn defaults.
- New components in this branch (follow button, like button) are built with shadcn primitives.

### Error messages in Spanish

- `/login`: "Correo o contraseña incorrectos." (not Supabase's default English).
- `/signup`: "Este correo ya está registrado." / "La contraseña debe tener al menos 6 caracteres."
- `/signup` brand path (in `feat/brand-registration`): same pattern — Spanish inline errors.
- Errors are inline (below the field or in an alert), not browser alerts.

### Páginas 404 mínimas

- `src/app/marca/[slug]/not-found.tsx`: "Esta marca no existe o no está disponible."
- `src/app/prenda/[id]/not-found.tsx`: "Esta prenda no existe."
- `src/app/post/[id]/not-found.tsx`: "Este outfit no existe."
- Each page has a link back to `/feed`. Design: minimal, glass aesthetic, no external assets.

---

## Design constraints

- glass/tropical tokens must be preserved: `--color-forest/leaf/coral/blush/cream` stay in `globals.css`.
- shadcn's CSS variables must not overwrite Icon's custom tokens — use a separate namespace or prefix.
- Follow/like interactions must feel instant: optimistic UI (update state before server response, rollback on error).
- Mobile-first: buttons large enough for touch targets (min 44px).
- All copy in Spanish.
