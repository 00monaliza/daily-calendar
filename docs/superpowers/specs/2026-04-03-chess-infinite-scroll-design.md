# Chess Grid Infinite Scroll — Design Spec

**Date:** 2026-04-03  
**Status:** Approved

---

## Overview

Add infinite horizontal scroll to the шахматка (chess grid) section. Users can scroll left (past) and right (future) to navigate the calendar without manually changing date range inputs. The date picker remains as a "jump to date" teleport control.

---

## Architecture

`ChessPage` owns the date window state (`from`/`to`) and all extension/trim logic. The grid components are responsible only for rendering and firing sentinel intersection events. No external library is added.

```
ChessPage
  ├── state: from, to (date window)
  ├── extendPrev()   — prepend 3 months
  ├── extendNext()   — append 3 months
  ├── trimWindow()   — keep ±6 months from anchor
  ├── SummaryBar
  ├── DatePicker (teleport mode)
  └── ChessGrid / MobileChessGrid
        ├── sentinel-left  (IntersectionObserver → onLoadPrev)
        └── sentinel-right (IntersectionObserver → onLoadNext)
```

---

## Initial State

On mount, the window opens to **current month −2 months → current month +2 months** (5 months total). This gives context in both directions immediately.

---

## Infinite Scroll Mechanics

### Sentinels
Two invisible `<th>` elements (width: 1px, height: 1px) are placed:
- `sentinel-left`: first column of `<thead>`
- `sentinel-right`: last column of `<thead>`

### IntersectionObserver
Each grid component mounts one `IntersectionObserver` watching both sentinels against the scrollable container (not the viewport). When a sentinel intersects:
- Left sentinel → call `onLoadPrev()`
- Right sentinel → call `onLoadNext()`

Observer uses `threshold: 0.1` and `root` set to the scroll container `<div>`.

### Scroll jump compensation (left extension)
When `extendPrev()` adds N days to the left, the table width increases on the left side, causing the visible content to jump. Fix: after state update + re-render, read `addedColumns * COL_WIDTH` and set `scrollContainer.scrollLeft += delta`.

This is done in `ChessPage` via a `useEffect` that tracks the previous `from` value and fires after render.

### Loading guard
A `isLoadingMore` ref prevents duplicate triggers while a fetch is in flight. The observer callback checks this ref before calling extend functions.

---

## Window Trimming

After each extension, if the total window exceeds 12 months, trim the far end:
- Extended right → trim from left (remove months before `anchor - 6mo`)
- Extended left → trim from right (remove months after `anchor + 6mo`)

**Anchor** = the leftmost visible date, derived from `scrollLeft / COL_WIDTH` offset into the days array.

Trimming happens only after the new data has loaded — in a `useEffect` in `ChessPage` that watches the `bookings` array for changes after an extension.

---

## Date Picker (Teleport Mode)

The existing `from`/`to` inputs are replaced with a single "jump to date" input (type="month"). On change:
- Set `from` = first day of selected month − 2 months
- Set `to` = last day of selected month + 2 months
- After render, scroll to the column matching the 1st of the selected month

The "Текущий месяц" button remains and resets to the initial state (current month ±2).

---

## Data Fetching

`useBookings(userId, from, to)` already accepts a date range. When `from`/`to` change, React Query re-fetches the entire window as one query. No manual merging needed — the new result covers the full `from`–`to` range.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/chess/ChessPage.tsx` | Window state, extend/trim logic, teleport date picker, scroll compensation |
| `src/widgets/chess-grid/ChessGrid.tsx` | Add sentinels, IntersectionObserver, expose `onLoadPrev`/`onLoadNext` props |
| `src/widgets/chess-grid/MobileChessGrid.tsx` | Same sentinel + observer changes as ChessGrid |

---

## Props Interface Changes

```ts
// ChessGrid & MobileChessGrid — add:
onLoadPrev: () => void
onLoadNext: () => void
scrollContainerRef: React.RefObject<HTMLDivElement>
```

The `currentMonth` prop (currently unused in both grids) is removed.

---

## Edge Cases

- **No properties**: existing empty state is unchanged.
- **Rapid scroll**: loading guard ref prevents stacked requests.
- **Jump to very old/future date**: teleport resets the window; no trimming needed since it's a full reset.
- **Mobile**: same approach applies to `MobileChessGrid`, same COL_WIDTH (36px).
