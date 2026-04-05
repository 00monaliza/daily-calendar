# Chess Grid: Colors & Scroll Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs in the шахматка (chess) calendar grid: (1) all imported bookings render with the same default teal/beige color instead of distinct per-property colors, and (2) users cannot scroll the grid backward past the initial `from` date (February 2026).

**Architecture:**
- Issue 1: Add a `derivePropertyColor(id)` utility (djb2 hash → palette index) used as fallback when a property has the DB-default color. Update import script to assign distinct colors at creation time.
- Issue 2: Replace `useEffect` with `useLayoutEffect` for the scroll-compensation effect in `ChessPage`. `useLayoutEffect` fires synchronously after React commits DOM mutations (new columns rendered), before browser paint — ensuring `scrollWidth` is already recalculated when we set `scrollLeft`.

**Tech Stack:** React 19, TypeScript, date-fns, Vite, Playwright (e2e tests)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/lib/propertyColors.ts` | **Create** | Palette array + `derivePropertyColor(id)` |
| `src/widgets/chess-grid/ChessGrid.tsx` | **Modify** | Use derived color fallback for booking cards + property dot |
| `src/widgets/chess-grid/MobileChessGrid.tsx` | **Modify** | Same as ChessGrid |
| `src/pages/chess/ChessPage.tsx` | **Modify** | `useEffect` → `useLayoutEffect` for two scroll effects |
| `import_nasutki.js` | **Modify** | Assign palette color when creating properties |

> **Note:** `BookingModal.tsx` has its own `BOOKING_COLORS` picker for the per-booking color override — it does NOT display `property.color` and needs no changes.

---

## Task 1: Create property color utility

**Files:**
- Create: `src/shared/lib/propertyColors.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/shared/lib/propertyColors.ts

export const PROPERTY_COLOR_PALETTE = [
  '#376E6F', // teal (existing brand color)
  '#E67E22', // orange
  '#8E44AD', // purple
  '#2980B9', // blue
  '#27AE60', // green
  '#E74C3C', // red
  '#16A085', // dark teal
  '#D35400', // dark orange
  '#2C3E50', // dark navy
  '#F39C12', // yellow-orange
]

/** djb2 hash of a string → integer */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0 // keep unsigned 32-bit
  }
  return hash
}

/**
 * Returns a deterministic color from PROPERTY_COLOR_PALETTE based on the
 * property's UUID. Same id always returns the same color.
 */
export function derivePropertyColor(id: string): string {
  return PROPERTY_COLOR_PALETTE[hashString(id) % PROPERTY_COLOR_PALETTE.length]
}

/**
 * Returns the effective display color for a property:
 * - If color has been customized (not the DB default '#376E6F'), use it.
 * - Otherwise derive a unique color from the property's id.
 *
 * This handles properties created by import_nasutki.js that were assigned
 * the DB-default color and therefore all look the same.
 */
export function getPropertyColor(property: { id: string; color: string }): string {
  return property.color !== '#376E6F' ? property.color : derivePropertyColor(property.id)
}
```

- [ ] **Step 2: Verify the function produces distinct colors**

Open a browser console and run (or add a temporary `console.log` to any component):
```js
// Quick sanity check - these should all print different colors
import { derivePropertyColor, getPropertyColor } from '@/shared/lib/propertyColors'
console.log(derivePropertyColor('abc-123'))
console.log(derivePropertyColor('def-456'))
console.log(derivePropertyColor('ghi-789'))
// All three should differ
```
Expected: three different hex strings from the palette.

- [ ] **Step 3: Commit**

```bash
git add src/shared/lib/propertyColors.ts
git commit -m "feat: add property color palette and derivePropertyColor utility"
```

---

## Task 2: Apply color fallback in ChessGrid

**Files:**
- Modify: `src/widgets/chess-grid/ChessGrid.tsx`

- [ ] **Step 1: Add import**

At the top of `src/widgets/chess-grid/ChessGrid.tsx`, add the import after the existing imports:
```typescript
import { getPropertyColor } from '@/shared/lib/propertyColors'
```

- [ ] **Step 2: Replace property.color usages**

Find line 197 (property dot in the sidebar):
```typescript
style={{ backgroundColor: property.color }}
```
Replace with:
```typescript
style={{ backgroundColor: getPropertyColor(property) }}
```

Find line 213 (booking card color):
```typescript
const cardColor = booking.color ?? property.color
```
Replace with:
```typescript
const cardColor = booking.color ?? getPropertyColor(property)
```

- [ ] **Step 3: Verify visually**

Run `npm run dev`, open the chess grid. Each property's row should now show a different colored booking card. The dot indicator in the left column should also match each property's derived color.

- [ ] **Step 4: Commit**

```bash
git add src/widgets/chess-grid/ChessGrid.tsx
git commit -m "feat: use derived property color fallback in ChessGrid"
```

---

## Task 3: Apply color fallback in MobileChessGrid

**Files:**
- Modify: `src/widgets/chess-grid/MobileChessGrid.tsx`

- [ ] **Step 1: Add import**

At the top of `src/widgets/chess-grid/MobileChessGrid.tsx`, add:
```typescript
import { getPropertyColor } from '@/shared/lib/propertyColors'
```

- [ ] **Step 2: Find and replace property.color usages**

Search the file for `property.color`. Replace each occurrence with `getPropertyColor(property)`. Typical locations:
- Property dot indicator in the sidebar `<td>`
- Booking card color: `booking.color ?? property.color`

The pattern is identical to ChessGrid — replace `property.color` with `getPropertyColor(property)` in every occurrence.

- [ ] **Step 3: Commit**

```bash
git add src/widgets/chess-grid/MobileChessGrid.tsx
git commit -m "feat: use derived property color fallback in MobileChessGrid"
```

---

## Task 4: Update import script to assign colors for new properties

**Files:**
- Modify: `import_nasutki.js`

- [ ] **Step 1: Add the palette at the top of the file**

After the constants block at the top of `import_nasutki.js` (after line ~8), add:
```javascript
const PROPERTY_COLORS = [
  '#376E6F', '#E67E22', '#8E44AD', '#2980B9', '#27AE60',
  '#E74C3C', '#16A085', '#D35400', '#2C3E50', '#F39C12',
]
```

- [ ] **Step 2: Track a color index in main()**

In the `main()` function, add a counter just before the loop that creates/finds properties (around line 163):
```javascript
let colorIndex = 0
```

- [ ] **Step 3: Assign color when creating a new property**

In the `createProperty` call inside the loop (around line 178), pass the color:
```javascript
const newId = await createProperty(flatName, PROPERTY_COLORS[colorIndex % PROPERTY_COLORS.length])
colorIndex++
```

- [ ] **Step 4: Update createProperty to accept and use color**

Change the function signature and body (around line 62):
```javascript
async function createProperty(name, color) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      owner_id: OWNER_ID,
      name: name,
      base_price: 0,
      color: color,
    })
  })
  const data = await res.json()
  if (!res.ok) {
    console.error(`  ❌ Не удалось создать квартиру "${name}": ${JSON.stringify(data)}`)
    return null
  }
  return data[0]?.id || null
}
```

- [ ] **Step 5: Commit**

```bash
git add import_nasutki.js
git commit -m "feat: assign distinct palette colors when creating properties during import"
```

---

## Task 5: Fix backward scroll with useLayoutEffect

**Files:**
- Modify: `src/pages/chess/ChessPage.tsx`

**Context:** `useEffect` fires after the browser has painted. When `from` changes (new columns prepended to the table), there is a race between the DOM layout recalculation and the `scrollLeft` adjustment. `useLayoutEffect` fires synchronously after React commits the DOM but before paint — at this point the browser has already computed the new `scrollWidth`, so `scrollLeft` adjustments are applied correctly.

- [ ] **Step 1: Add useLayoutEffect to React import**

At line 1 of `ChessPage.tsx`, change:
```typescript
import { useState, useRef, useEffect, useCallback } from 'react'
```
to:
```typescript
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
```

- [ ] **Step 2: Convert scroll compensation effect to useLayoutEffect**

Find the effect at line 93 (the one with `[from]` dependency, not `[isSuccess]` or `[bookings]`):
```typescript
useEffect(() => {
  const container = scrollContainerRef.current
  if (isTeleportRef.current || !container) {
    prevFromRef.current = from
    return
  }
  const daysDiff = differenceInCalendarDays(parseISO(from), parseISO(prevFromRef.current))
  if (daysDiff !== 0) {
    container.scrollLeft -= daysDiff * COL_WIDTH
  }
  prevFromRef.current = from
}, [from])
```
Change `useEffect` → `useLayoutEffect`:
```typescript
useLayoutEffect(() => {
  const container = scrollContainerRef.current
  if (isTeleportRef.current || !container) {
    prevFromRef.current = from
    return
  }
  const daysDiff = differenceInCalendarDays(parseISO(from), parseISO(prevFromRef.current))
  if (daysDiff !== 0) {
    container.scrollLeft -= daysDiff * COL_WIDTH
  }
  prevFromRef.current = from
}, [from])
```

- [ ] **Step 3: Convert teleport scroll effect to useLayoutEffect**

Find the effect at line 106 (the one with `[from, to]` dependency):
```typescript
useEffect(() => {
  const target = teleportTargetRef.current
  const container = scrollContainerRef.current
  if (!target || !container) return
  const dayOffset = differenceInCalendarDays(parseISO(target), parseISO(from))
  const halfVisible = Math.floor((container.clientWidth - 160) / 2)
  container.scrollLeft = Math.max(0, dayOffset * COL_WIDTH - halfVisible)
  teleportTargetRef.current = null
  isTeleportRef.current = false
}, [from, to])
```
Change `useEffect` → `useLayoutEffect`:
```typescript
useLayoutEffect(() => {
  const target = teleportTargetRef.current
  const container = scrollContainerRef.current
  if (!target || !container) return
  const dayOffset = differenceInCalendarDays(parseISO(target), parseISO(from))
  const halfVisible = Math.floor((container.clientWidth - 160) / 2)
  container.scrollLeft = Math.max(0, dayOffset * COL_WIDTH - halfVisible)
  teleportTargetRef.current = null
  isTeleportRef.current = false
}, [from, to])
```

- [ ] **Step 4: Verify scroll behavior**

Run `npm run dev`. Open the chess grid. It should scroll to today. Then:
1. Scroll left until you reach the left edge — the grid should load previous months automatically
2. Continue scrolling left — you should be able to reach 2023 data
3. Click "Сегодня" — should jump back to today ✓
4. Use "Перейти к" to jump to January 2024 — should work ✓

- [ ] **Step 5: Commit**

```bash
git add src/pages/chess/ChessPage.tsx
git commit -m "fix: use useLayoutEffect for scroll compensation to prevent race with DOM layout"
```

---

## Self-Review

**Spec coverage:**
- ✅ Distinct color per property → Tasks 1–3
- ✅ Color stored/derived from property_id → Task 1 (`derivePropertyColor` + `getPropertyColor`)
- ✅ New bookings use property color (not beige) → Tasks 2–3
- ✅ Backward scroll to 2023 data → Task 5
- ✅ Today highlighted but not blocking backward nav → Task 5 (no change to today highlight logic)
- ✅ Import script assigns colors → Task 4
- ⚠️ BookingModal: spec said to apply fallback — confirmed NOT needed (BookingModal uses its own `BOOKING_COLORS` picker, not `property.color`)

**Placeholder scan:** None found.

**Type consistency:** `getPropertyColor` takes `{ id: string; color: string }` — matches both `Property` type and the inline property objects used in both grid components. ✓
