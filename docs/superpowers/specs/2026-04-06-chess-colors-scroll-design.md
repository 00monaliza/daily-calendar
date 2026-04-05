# Chess Grid: Colors & Scroll Fix — Design Spec

**Date:** 2026-04-06  
**Status:** Approved

---

## Problem Summary

Two bugs in the Chess (шахматка) calendar grid:

1. **Colors** — All imported bookings show in the same default beige because `import_nasutki.js` creates properties without a `color` field. The DB default is beige.
2. **Scroll** — Users cannot scroll left past February 2026 (the initial `from` boundary). The scroll compensation `useEffect` runs after browser paint, potentially before `scrollWidth` reflects newly prepended columns.

---

## Issue 1: Property Color System

### Root Cause
`import_nasutki.js` calls `createProperty(name)` with no `color` field → Supabase uses the DB default (beige). `ChessGrid.tsx:213` already does `booking.color ?? property.color`, but `property.color` is beige for all imported properties.

### Solution: Palette + UI Fallback

**New file: `src/shared/lib/propertyColors.ts`**

A palette of 10 visually distinct colors (similar to Google Calendar). Exports:
- `PROPERTY_COLOR_PALETTE: string[]` — the 10 hex colors
- `derivePropertyColor(id: string): string` — djb2 hash of `id` → index into palette → hex color

**`import_nasutki.js`**

When creating new properties, pass `color: PALETTE[index % PALETTE.length]` where `index` is the 0-based order of creation. Existing properties in DB are not touched — the UI fallback handles them.

**`ChessGrid.tsx` and `MobileChessGrid.tsx`**

Replace `property.color` with `property.color || derivePropertyColor(property.id)` at every point where property color is used as a booking card color.

**`BookingModal.tsx`**

If property color is displayed in the modal, apply the same fallback.

### What is NOT changed
- DB schema
- Booking `color` field (still overrides property color when set)
- Properties page (users can still manually edit colors there)

---

## Issue 2: Horizontal Scroll Navigation

### Root Cause
`useEffect([from])` at `ChessPage.tsx:93` runs the scroll compensation (`scrollLeft += diff * COL_WIDTH`) **after browser paint**. At that moment, the browser may not have completed layout for the newly prepended columns, so `scrollWidth` still reflects the old table width and the scroll adjustment has no effect.

Additionally, the IntersectionObserver sentinel fires **on mount** (when `scrollLeft = 0` before initialization), calling `extendPrev` prematurely.

### Solution: useLayoutEffect + initialization guard

**`ChessPage.tsx`**

1. Change `useEffect([from])` (line 93, scroll compensation) → `useLayoutEffect([from])`.  
   `useLayoutEffect` fires synchronously after DOM mutations, before paint. At this point React has committed the new columns and browser layout is complete, so `scrollWidth` is correct.

2. Change `useEffect([from, to])` (line 106, teleport scroll) → `useLayoutEffect([from, to])` for consistency.

**`ChessGrid.tsx` and `MobileChessGrid.tsx`**

3. In the IntersectionObserver callback, add a guard: only call `onLoadPrev` / `onLoadNext` if the grid has been initialized (pass `isInitializedRef` or a boolean `initialized` prop, or check via a ref passed from ChessPage).  
   Simplest: pass an `initialized` boolean prop from `ChessPage` (set to `true` after first `isSuccess`). The IO callback skips firing if `!initialized`.

### What is NOT changed
- `extendPrev` / `extendNext` logic
- Trimming logic
- `isLoadingMoreRef` debounce
- Window size (still 12 months max)

---

## Files to Change

| File | Change |
|------|--------|
| `src/shared/lib/propertyColors.ts` | **Create** — palette + derivePropertyColor |
| `src/widgets/chess-grid/ChessGrid.tsx` | Use derivePropertyColor fallback + accept `initialized` prop |
| `src/widgets/chess-grid/MobileChessGrid.tsx` | Same as above |
| `src/pages/chess/ChessPage.tsx` | useLayoutEffect for scroll effects; pass `initialized` to grids |
| `import_nasutki.js` | Assign colors from palette when creating properties |
| `src/widgets/booking-modal/BookingModal.tsx` | Apply color fallback if property color shown |

---

## Success Criteria

1. Each property shows a distinct color in the grid (not beige)
2. User can scroll left past February 2026 all the way to 2023 data
3. Current date is still highlighted but does not block backward navigation
4. No regressions in forward scroll, teleport, or "Today" button
