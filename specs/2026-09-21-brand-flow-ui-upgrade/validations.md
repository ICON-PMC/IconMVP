# Validations — Brand Flow UI Upgrade

All checks must pass before merging `feat/brand-flow-ui-upgrade` → `main`.

## Global
- [x] `npx tsc --noEmit`, `npm run lint` and `npm run build` are clean.
- [ ] No horizontal scroll at 360, 390, 768, 1280 px on: `/marca/panel` (each tab), `/marca/panel/post/[id]`, `/marca/panel/import`, `/onboarding/marca`, `/admin` (each tab), `/admin/bulk`.
- [ ] All interactive targets ≥ 44×44 px on mobile; inputs use ≥ 16 px font on mobile (no iOS zoom).
- [x] Only tokens from `globals.css` are used; `--color-forest` etc. untouched.
- [ ] Keyboard: tabs, sheets, dialogs and selection are operable; focus is trapped in dialogs/sheets and returns to trigger on close; visible focus ring.
- [x] Status is never conveyed by color alone (badge has text).
- [x] Copy is inclusive Spanish (grep for "usuaria" returns nothing).
- [ ] No behavior regression: existing server actions produce the same DB effects.

## Group 1 — Foundation
- [x] Toaster mounted once; a test toast renders and is dismissible.
- [x] `ChipSelect` submits the same form field names as before (`sizes`, `occasions`, `styles`, `temperatures`, `garments`).
- [ ] `ConfirmDialog` traps focus and cancels on Esc.

## Group 2 — Panel shell
- [x] `?tab=` selects the tab; invalid value falls back to Resumen; back/forward works.
- [ ] Status banner (pending / rejected + note / active) still renders correctly.
- [ ] Non-brand / no-brand states unchanged (connect-Instagram empty state).

## Group 3 — Catalog
- [ ] New garment via sheet creates a garment with image, sizes and category (same as before); sheet closes and list refreshes.
- [ ] Selection mode: select one / all / clear; sticky bar shows count and never covers the last row.
- [ ] Bulk publish / archive / delete change only the brand's own garments; deleting asks for confirmation; partial failures are reported ("n de m").
- [x] Brand A cannot affect brand B's garments (RLS probe with a forged id).

## Group 4 — Looks / post editor
- [x] Multi-add of garments to a look works; removing works; Publish disabled with reason when 0 garments.
- [ ] Tag chips persist (occasion/style/temperature).

## Group 5 — Import picker
- [ ] Select all / none; "Importar N" matches selection; result toast reports created/errors.

## Groups 6–7 — Admin
- [x] Staff-only access unchanged (anon/regular users redirected).
- [ ] Each create form (marca / prenda / post) still creates the record; only one form visible at a time.
- [ ] Bulk photos: per-row status, upload N, delete selected with confirm, errors listed per row.

## Group 8 — Onboarding
- [ ] Step indicator reflects real progress; submit-for-approval still gated on ≥1 garment.

## Group 9 — QA
- [ ] Manual pass on a real phone (or device emulation) for the brand flow end to end: register → add garment → tag look → publish.

## QA status (see plan.md group 9 for details)
Automated browser + DB pass done at 360/768/1280 px for the brand panel, post editor, admin tabs and `/admin/bulk` (no overflow, ≥ 44 px targets, bulk archive, picker, RLS probe). **Still open — verify by hand before merge:** onboarding stepper/sticky submit, Instagram import flow, creating a garment with a photo, bulk publish / confirmed delete, keyboard focus trapping in sheets/dialogs, `/admin/bulk` upload + delete, and one pass on a real phone. Their boxes above are intentionally left unticked.
