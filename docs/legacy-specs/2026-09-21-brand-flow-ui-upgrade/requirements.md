# Requirements — Brand Flow UI Upgrade

## Problem
The brand-facing screens (`/marca/panel`, `/marca/panel/post/[id]`, `/marca/panel/import`, `/onboarding/marca`) and the staff screens that manage brand content (`/admin`, `/admin/bulk`) stack every form and list in one long scroll of glass cards. Creating a garment, editing the profile, connecting Instagram, tagging items and bulk uploading all compete for attention at once; on a phone it is worse (2-column form grids, tiny tap targets, native `<details>`, raw `<select>`s, `window.confirm`). Bulk work (many garments / many photos) has no selection model, no clear progress and no clear primary action.

## Goal
A cleaner, calmer brand flow: one thing at a time, obvious primary action, the right component for each job, and **mobile-first** (brands will mostly manage their catalog from a phone).

## In scope
- Brand panel restructured into sections (tabs): Resumen · Catálogo · Looks · Perfil.
- Catalog management: list/grid of garments with status, **selection mode + sticky bulk action bar** (publish, archive, delete), "new garment" in a sheet (bottom sheet on mobile, side sheet on desktop).
- Post (look) editor: sectioned editor, garment tagging via a picker (not a raw `<select>`), chip groups for occasion/style/temperature.
- Instagram import picker: selection with sticky action bar and count.
- Admin: `/admin` split into tabs (Métricas · Cargar contenido · Marcas pendientes); creation forms collapsed behind a single "Crear" entry point. `/admin/bulk` pending-photos list gets the same selection/progress model.
- Shared primitives so every screen uses the same patterns (see plan group 1).
- Toasts for success/error instead of `?ok=` / `?error=` banners where the action is client-driven; confirm dialogs instead of `window.confirm`.

## Out of scope
- New business logic, schema changes, or RLS changes (UI only — except server actions strictly needed for bulk status changes, which reuse existing RLS).
- Public pages (`/feed`, `/marca/[slug]`, `/prenda/[id]`), search, saved.
- Redesign of the glass/tropical visual identity — tokens stay; components compose them.
- Brand-panel features not yet built (analytics, garment edit page beyond what exists) — only layout hooks.

## UX principles (acceptance lens)
1. **One primary action per view**; secondary actions are visually quieter.
2. **Progressive disclosure**: forms open on demand (sheet), not inline forever.
3. **Right component**: Tabs for sections, Sheet/Dialog for creation, AlertDialog for destructive confirm, Checkbox/ToggleGroup for multi-select, Select/Combobox for long lists, Badge for status, Skeleton/empty states for loading and empty.
4. **Feedback**: every action shows pending state, and success/error via toast; bulk ops show "n of m".
5. **Mobile-first**: designed at 360 px; tap targets ≥ 44 px; no horizontal scroll; sticky bottom bars respect `env(safe-area-inset-bottom)`; single-column forms below `sm`; inputs `text-base` on mobile (avoids iOS zoom).
6. **Accessible**: labels tied to inputs, focus visible, dialogs trap focus, status not conveyed by color alone.
7. **Consistent with existing system**: only tokens from `globals.css` (forest/leaf/coral/blush/cream); no parallel color system. Inclusive Spanish copy ("usuario", neutral phrasing).

## Decisions
- Tabs are URL-driven (`?tab=`) so they are linkable and survive server-action redirects, matching the existing `/admin?tab=marcas` pattern.
- shadcn (base-nova, `@base-ui/react`) components are added with `npx shadcn@latest add`; the glass look is applied via variants/classes, not by forking tokens.
