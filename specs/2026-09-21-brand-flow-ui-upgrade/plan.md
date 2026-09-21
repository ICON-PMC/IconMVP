# Plan — Brand Flow UI Upgrade

> **Special notes (apply to every task group)**
> - **Inclusive language:** "usuario" (never "usuaria"), neutral phrasing in all UI copy (constitution §1).
> - **UI only.** No schema/RLS changes. If a bulk action needs a new server action, it must go through the user's own RLS (brand owner) or `requireStaff()`.
> - **Mobile-first:** design at 360 px, then scale up. Check every group at 360 / 390 / 768 / 1280.
> - **Tokens only:** colors from `globals.css`; new shadcn components are themed via the existing token mapping.

## Progress
- [x] 1. Foundation: shadcn components + shared primitives
- [ ] 2. Brand panel shell: tabs, header, status, Instagram card
- [ ] 3. Catalog: list, new-garment sheet, selection mode + bulk action bar
- [ ] 4. Looks list + post editor
- [ ] 5. Instagram import picker
- [ ] 6. Admin panel: tabs + collapsed create forms
- [ ] 7. Admin bulk photos (`/admin/bulk`)
- [ ] 8. Onboarding (`/onboarding/marca`) polish
- [ ] 9. QA pass (responsive, a11y, build, lint)

## Task groups

### 1. Foundation
- Add shadcn components: `tabs`, `sheet`, `alert-dialog`, `checkbox`, `dropdown-menu`, `sonner` (toasts), `skeleton`, `separator`, `toggle-group` (or chip toggle), `command`/combobox if needed for garment picker.
- Mount `<Toaster />` in the root layout.
- Shared primitives in `src/components/` (all glass-token based):
  - `PageShell` (max-width, gutters, safe-area bottom padding) and `SectionHeader` (title + description + primary action).
  - `FormField` (label + control + hint/error), replacing the per-page `input`/`label` class strings.
  - `ChipSelect` (accessible multi-select chips; replaces the `peer-checked` checkbox hack and duplicated `FieldChips`/`ChipGroup`).
  - `StatusBadge` (draft / pending / published / archived, text + color).
  - `EmptyState`, `ConfirmDialog` (AlertDialog wrapper), `StickyActionBar` (bottom on mobile, respects safe area).
  - `useSelection` hook (Set-based multi-select with select-all / clear).
- Global mobile rules in `globals.css`: min tap target utility, `text-base` inputs below `sm`, `.pb-safe` helper.

**✅ Done — implementation notes**
- **shadcn added** (`tabs sheet alert-dialog checkbox dropdown-menu sonner skeleton separator toggle toggle-group`). The generator again imported `cn` from the unrelated npm package `cn` (same trap as brand-registration): rewrote imports to `@/lib/utils`, removed `cn` and `next-themes` from `package.json`. `sonner.tsx` no longer uses `next-themes` (the app has no theme provider; fixed to `light`). `<Toaster position="top-center" />` mounted in `src/app/layout.tsx`. Existing `button.tsx` was not overwritten.
- **Tap targets:** `Button` default/lg/icon and `Input` are now 44 px+ below `md` and back to the compact shadcn size from `md` up (affects existing login/signup/onboarding forms too — slightly taller on phones only).
- **Primitives** in `src/components/`: `page-shell.tsx` (`PageShell`, `SectionHeader`), `form-field.tsx`, `chip-select.tsx` (button chips + hidden inputs, so form field names are unchanged), `status-badge.tsx`, `empty-state.tsx`, `confirm-dialog.tsx`, `sticky-action-bar.tsx`; hook `src/lib/use-selection.ts`.
- **`globals.css`:** `pb-safe-bar` utility (room for the sticky bar + safe area) and 16 px `glass-input` fields below `md` (prevents iOS zoom).
- `tsc`, `lint`, `build` clean. Not yet used by any screen — groups 2+ consume them.

### 2. Brand panel shell
- Rewrite `src/app/marca/panel/page.tsx` as a server component that reads `?tab=` and renders Resumen · Catálogo · Looks · Perfil. Tab bar scrolls horizontally on small screens, no wrap.
- **Resumen:** status banner, counts (prendas, looks, borradores), Instagram connection as one compact card, quick actions ("Nueva prenda", "Importar fotos").
- **Perfil:** single-column form with `FormField`, sticky Save on mobile.
- Split large page into per-tab components under `src/app/marca/panel/_components/`.

### 3. Catalog
- Responsive grid (2 cols mobile → 4 desktop) of garment cards with `StatusBadge`, price, image.
- "Nueva prenda" opens a **Sheet** (bottom on mobile, right on `md+`); form is single-column; sizes via `ChipSelect`; category via shadcn `Select`.
- **Selection mode:** "Seleccionar" toggle → checkboxes on cards → `StickyActionBar` with count and actions: Publicar, Archivar, Eliminar (ConfirmDialog). Actions call new brand-scoped server actions; result toast shows "n de m".
- Filter by status (ToggleGroup / tabs) and search-by-title input.

### 4. Looks + post editor
- Looks tab: grid with status badge, item count, publish state; empty state with CTA.
- `/marca/panel/post/[id]`: image + primary Publish/Unpublish in a sticky header; sections as an accordion/steps: Prendas taggeadas · Ocasión, estilo y clima. Garment picker as a Sheet with search and multi-select (add several at once); size chosen per item inline. Publish disabled with a clear reason when no garment is tagged.

### 5. Instagram import picker
- Keep grid selection; add `StickyActionBar` ("Importar N"), select-all, progress ("n de m"), and toast result. Larger tap targets for the check.

### 6. Admin panel
- Extend `AdminTabs` to: Métricas · Cargar contenido · Marcas pendientes (scrollable on mobile).
- Métricas tab: metric tiles + click analytics only.
- "Cargar contenido" tab: segmented switch Marca / Prenda / Post, one form visible at a time, single-column on mobile. Reuse `FormField` / `ChipSelect`; replace raw `<select>` with shadcn `Select` where the list is long (brands, garments picker).
- Pending brands review: cards stack on mobile; approve/reject actions in a dropdown or full-width buttons.

### 7. Admin bulk photos
- `PendingGarments`: list rows (thumbnail-less) with file-pick button, per-row status (pendiente / lista / error), selection for delete, sticky bar "Subir N fotos" / "Eliminar N", `ConfirmDialog` instead of `window.confirm`, progress "n de m".
- Template + import step collapsed into a compact "Paso 1" card with clear step indicator.

### 8. Onboarding polish
- Step indicator (Perfil → Primera prenda → Enviar), single-column forms with `FormField`, sticky primary button on mobile. No logic changes to `actions.ts`.

### 9. QA pass
- See `validations.md`. Fix regressions; update this plan's progress and add implementation notes per group as done.

## Open questions
- Do brand owners already have RLS `UPDATE`/`DELETE` on their own `garments` rows (needed for bulk publish/archive/delete)? Verify in group 3 before writing actions; if not, surface as a follow-up rather than changing policies here.
- Toast library: `sonner` via shadcn assumed; confirm it works with the installed base-nova style.
