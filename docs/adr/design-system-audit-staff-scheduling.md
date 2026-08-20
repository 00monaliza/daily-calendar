# Design System Audit — Staff Scheduling Feature

Date: 2026-08-21
Scope: inputs for [staff scheduling spec](../superpowers/specs/2026-08-21-staff-scheduling-design.md)

## Summary

**Components reviewed:** 6 (Toast, Toggle, BottomSheet, ChessGrid,
GuestsPage tables/cards, propertyColors lib) | **Formal tokens
defined:** minimal (4 brand colors as CSS vars) | **Reuse verdict:**
the app has no formal design system — it's Tailwind v4 utility
classes plus four brand color variables and a handful of ad hoc
`shared/ui` primitives. There's enough to build on consistently, but
nothing to "audit for violations" in the traditional sense. This is a
gap inventory + reuse plan, not a compliance score.

## Token Coverage

| Category | Defined | Notes |
|----------|---------|-------|
| Colors | 4 CSS vars in `global.css` (`--color-brand: #376E6F`, `--color-brand-dark`, `--color-accent`, `--color-dark`) | Everywhere else, hex/Tailwind grays are hardcoded inline (`text-[#376E6F]`, `border-gray-200`, `bg-gray-50`). No semantic tokens (success/warning/error) beyond ad hoc `green-*`/`red-*` in `Toast.tsx`. |
| Spacing | None defined | Tailwind defaults used directly (`p-2`, `gap-4`, `px-4 py-3`) — consistent by convention, not tokens. |
| Typography | None defined | System font stack in `body`; sizes via Tailwind (`text-xs`, `text-sm`, `text-base`) applied ad hoc. |
| Radius | None defined | `rounded-lg` (cards), `rounded-xl` (bottom sheet, guest cards), `rounded-full` (pills, badges, spinner) used consistently by convention. |
| Motion | None defined | `transition-colors`, `transition-all duration-300` inline per component. |

**Recommendation for this feature:** don't invent a token system the
rest of the app doesn't have. Follow the existing convention (inline
Tailwind + the 4 brand CSS vars) rather than introducing a parallel
one just for `/staff`. The one new token worth adding is a **shift
status color scale** (below), because it's the one place this
feature needs a small closed set of colors used consistently across
two surfaces (manager grid + employee portal).

## Reusable As-Is

| Need | Reuse | Notes |
|------|-------|-------|
| Loading spinner | The `border-4 border-[#376E6F] border-t-transparent rounded-full animate-spin` pattern (used in `ProtectedRoute`, `AppRouter`'s `RouteFallback`, `GuestsPage`) | Copy verbatim for both new routers. |
| Toasts | `src/shared/ui/Toast.tsx` (`toast.success/.error` + `<ToastContainer/>`) | Works for both manager save-confirmations and employee-portal errors (e.g. failed PIN login). Mount `<ToastContainer/>` in both app layouts. |
| Modal container | `src/widgets/bottom-sheet/BottomSheet.tsx` | Exactly fits "click a cell → modal with start/end time or OFF/VACATION/SICK" from the spec. Already handles Escape-to-close, scroll lock, safe-area padding — don't rebuild this. |
| Toggle | `src/shared/ui/Toggle.tsx` | Reuse for the employee "active" flag in the manager's employee list. |
| Card/table shell | The `bg-white rounded-xl border border-gray-200 overflow-hidden` shell + `border-b border-gray-100 last:border-0` row pattern from `GuestsPage.tsx` | Reuse for the employee list table. |
| Pill/badge | `text-xs px-1.5 py-0.5 rounded-full` (booking-status pills in `GuestsPage.tsx`) | Base shape for OFF/VACATION/SICK badges in the grid — swap only the color classes. |
| Deterministic color-from-id | `src/shared/lib/propertyColors.ts` (`derivePropertyColor`, `hashString`) | Same djb2-hash technique is directly reusable if you ever want per-employee row accent colors — not required by the spec, flagging as available. |
| Sticky/scrollable grid mechanics | `src/widgets/chess-grid/ChessGrid.tsx` (fixed `COL_WIDTH`, horizontal scroll container, `hexToRgb`/`contrastTextColor` for readable text on colored cells) | The schedule grid has the same shape as the booking chess grid (rows × day columns, colored cells, horizontal scroll on mobile). `contrastTextColor` in particular should be reused as-is for shift-cell text so colored cells stay legible — don't reimplement contrast math. |
| Drag-reorder rows | `SortablePropertyRow` pattern in `ChessGrid.tsx` (`@dnd-kit/core` + `@dnd-kit/sortable`) | Directly reusable for reordering employees by `sort_order` in the manager's employee list (not for shift drag-and-drop, which the spec deferred). |

## Gaps — New, Small Components Needed

### 1. Shift-status color scale (new token)

The spec's grid needs a closed set of visually distinct states:
`work` (uses the employee's own accent or a neutral "scheduled" fill),
`day_off`, `vacation`, `sick`. Define these once, next to
`propertyColors.ts`, e.g. `src/shared/lib/shiftStatusColors.ts`:

```ts
export const SHIFT_STATUS_COLORS = {
  work: { bg: '#EEF6F6', text: '#1C3334', border: '#376E6F' }, // brand-tinted
  day_off: { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' }, // neutral gray
  vacation: { bg: '#F3E8FF', text: '#6B21A8', border: '#D8B4FE' }, // purple, matches screenshot
  sick: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' }, // red
} as const
```

This mirrors the reference screenshot's convention (green=work,
gray/OFF, purple=vacation) without hardcoding hex values inline
across every grid cell.

### 2. `ShiftCell` component (new, small)

Not present today — the closest analog is a booking cell in
`ChessGrid`, but that renders guest/date-range info, not a single
day's status + time range + hours badge. Build as a small presentational
component in `src/widgets/staff-schedule-grid/ShiftCell.tsx` consuming
`SHIFT_STATUS_COLORS` + the existing `contrastTextColor` helper.

### 3. `ShiftEditModal` (new, thin wrapper)

A `BottomSheet` body with: status selector (work/day_off/vacation/sick),
conditional start/end time pickers when status = work, note field. No
new modal chrome needed — this is content inside the existing
`BottomSheet`.

### 4. PIN input (new, employee portal only)

Nothing in `shared/ui` handles numeric PIN entry. Small new component,
`src/shared/ui/PinInput.tsx` — plain, large-touch-target numeric input
(not a segmented per-digit widget; YAGNI given it's 4–6 digits and
this is a low-traffic internal login).

## Naming & Placement Conventions (FSD)

Given the existing layout (`src/entities/{property,booking,guest,settings}`,
`src/features/{auth,create-booking,...}`, `src/widgets/{chess-grid,bottom-sheet,...}`,
`src/pages/{chess,properties,guests,...}`):

| Layer | New slice | Contents |
|-------|-----------|----------|
| `entities` | `entities/staff-employee` | `types.ts`, `api.ts`, `queries.ts` (mirrors `entities/property`) |
| `entities` | `entities/staff-shift` | same shape, plus hour-calculation helpers (overnight-aware) |
| `shared/lib` | `shared/lib/shiftStatusColors.ts` | the color scale above, sibling to `propertyColors.ts` |
| `shared/ui` | `shared/ui/PinInput.tsx` | sibling to `Toast.tsx`/`Toggle.tsx` |
| `widgets` | `widgets/staff-schedule-grid` | `StaffScheduleGrid.tsx`, `ShiftCell.tsx`, `ShiftEditModal.tsx` — mirrors `widgets/chess-grid` |
| `pages` | `pages/staff/StaffSchedulePage.tsx` (manager) | mirrors `pages/properties/PropertiesPage.tsx` |
| `app` | `app/staff/StaffAppRouter.tsx` + `app/staff/StaffAppLayout.tsx` | new top-level surface per ADR-0001, not nested under the existing `AppLayout` |

Don't put employee-portal-only code under `pages/` (that's the owner
app's route tree) — keep it under `app/staff/` with its own tiny
router, per ADR-0001.

## Priority Actions

1. Add `shared/lib/shiftStatusColors.ts` first — every other new
   component depends on it.
2. Build `ShiftCell` + `ShiftEditModal` reusing `BottomSheet` and
   `contrastTextColor` — no new modal chrome, no new color-contrast
   math.
3. Reuse `ChessGrid`'s scroll/sticky-column mechanics for
   `StaffScheduleGrid` rather than starting from a blank grid layout.
4. Build `PinInput` last — it's isolated and low-risk, needed only
   for Milestone 2 (employee portal).
