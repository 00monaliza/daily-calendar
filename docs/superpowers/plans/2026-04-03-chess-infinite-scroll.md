# Chess Grid Infinite Scroll — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual date-range picker in шахматка with infinite horizontal scroll (left = past, right = future), keeping a single "jump to month" teleport control.

**Architecture:** `ChessPage` owns the date window state and extend/trim logic. Invisible sentinel `<th>` elements at each end of the grid trigger `IntersectionObserver` callbacks, which call `extendPrev` / `extendNext` in the page. A `prevFromRef` tracks left-side changes so `scrollLeft` can be compensated to prevent viewport jumps when prepending columns.

**Tech Stack:** React 18, date-fns, IntersectionObserver API (no new dependencies)

---

## File Map

| File | Change |
|------|--------|
| `src/pages/chess/ChessPage.tsx` | Replace range pickers with month teleport; add window state, extend/trim, scroll compensation |
| `src/widgets/chess-grid/ChessGrid.tsx` | Add `onLoadPrev`, `onLoadNext`, `scrollContainerRef` props; add sentinels + observer |
| `src/widgets/chess-grid/MobileChessGrid.tsx` | Same sentinel + observer changes as ChessGrid |
| `tests/e2e/chess.spec.ts` | Update tests to reflect new teleport UX |

---

## Task 1: Update ChessGrid props and add sentinels + IntersectionObserver

**Files:**
- Modify: `src/widgets/chess-grid/ChessGrid.tsx`

- [ ] **Step 1: Add new props to the interface**

In `src/widgets/chess-grid/ChessGrid.tsx`, update the `Props` interface. Remove `currentMonth` (unused). Add:

```tsx
interface Props {
  properties: Property[]
  bookings: (Booking | BookingWithProperty)[]
  from: string
  to: string
  onCellClick: (date: string, propertyId: string) => void
  onBookingClick: (booking: Booking) => void
  onLoadPrev: () => void
  onLoadNext: () => void
  scrollContainerRef: React.RefObject<HTMLDivElement>
}
```

- [ ] **Step 2: Add sentinel refs and update function signature**

Replace the function signature and add two refs at the top of the component body:

```tsx
export function ChessGrid({
  properties,
  bookings,
  from,
  to,
  onCellClick,
  onBookingClick,
  onLoadPrev,
  onLoadNext,
  scrollContainerRef,
}: Props) {
  const { data: settings } = useSettings()
  const showFullText = settings?.show_full_text ?? true
  const rowHeightClass = settings?.compact_mode ? 'h-7' : 'h-10'

  const leftSentinelRef = useRef<HTMLTableCellElement>(null)
  const rightSentinelRef = useRef<HTMLTableCellElement>(null)
```

Add `useRef` to the React import at the top of the file:
```tsx
import React, { useRef, useEffect } from 'react'
```

- [ ] **Step 3: Add IntersectionObserver effect**

After the `rightSentinelRef` declaration (before the `days` computation), add:

```tsx
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !leftSentinelRef.current || !rightSentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (entry.target === leftSentinelRef.current) onLoadPrev()
          if (entry.target === rightSentinelRef.current) onLoadNext()
        }
      },
      { root: container, threshold: 0.1 }
    )

    observer.observe(leftSentinelRef.current)
    observer.observe(rightSentinelRef.current)

    return () => observer.disconnect()
  }, [onLoadPrev, onLoadNext, scrollContainerRef])
```

- [ ] **Step 4: Add sentinel `<th>` elements to the table header**

In the `<thead><tr>` section, wrap the existing header cells with sentinels:

```tsx
          <tr>
            <th
              ref={leftSentinelRef}
              style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }}
              aria-hidden="true"
            />
            <th className="sticky left-0 z-20 bg-white border-b border-r border-gray-200 px-3 py-2 text-left text-xs text-gray-500 font-medium min-w-[160px]">
              Квартира
            </th>
            {days.map(day => {
              const today = isToday(day)
              return (
                <th
                  key={day.toISOString()}
                  className={`border-b border-gray-200 px-1 py-1 text-center min-w-[36px] ${today ? 'bg-[#376E6F]/10' : 'bg-white'}`}
                >
                  <div className={`text-xs font-medium ${today ? 'text-[#376E6F]' : 'text-gray-400'}`}>
                    {format(day, 'EEE', { locale: ru }).slice(0, 2)}
                  </div>
                  <div className={`text-sm font-bold ${today ? 'text-[#376E6F]' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </div>
                </th>
              )
            })}
            <th
              ref={rightSentinelRef}
              style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }}
              aria-hidden="true"
            />
          </tr>
```

- [ ] **Step 5: Pass scrollContainerRef to the container div**

The outer `<div>` already has `className="overflow-auto flex-1"`. Add the ref:

```tsx
  return (
    <div ref={scrollContainerRef} className="overflow-auto flex-1">
```

- [ ] **Step 6: Verify the file compiles with no TypeScript errors**

```bash
cd /Users/rizzgy/Documents/daily-calendar && npx tsc --noEmit 2>&1 | grep chess-grid/ChessGrid
```

Expected: no output (no errors).

- [ ] **Step 7: Commit**

```bash
cd /Users/rizzgy/Documents/daily-calendar && git add src/widgets/chess-grid/ChessGrid.tsx && git commit -m "feat: add infinite scroll sentinels and IntersectionObserver to ChessGrid"
```

---

## Task 2: Add sentinels + IntersectionObserver to MobileChessGrid

**Files:**
- Modify: `src/widgets/chess-grid/MobileChessGrid.tsx`

- [ ] **Step 1: Update imports**

```tsx
import { useRef, useEffect } from 'react'
import { format, eachDayOfInterval, parseISO, isToday, isSameDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Property } from '@/entities/property/types'
import type { Booking, BookingWithProperty } from '@/entities/booking/types'
import { useSettings } from '@/entities/settings/queries'
```

- [ ] **Step 2: Update Props interface**

Replace the interface (remove `currentMonth`, add new props):

```tsx
interface Props {
  properties: Property[]
  bookings: (Booking | BookingWithProperty)[]
  from: string
  to: string
  onCellClick: (date: string, propertyId: string) => void
  onBookingClick: (booking: Booking) => void
  onLoadPrev: () => void
  onLoadNext: () => void
  scrollContainerRef: React.RefObject<HTMLDivElement>
}
```

Add `import React from 'react'` at the top (needed for `React.RefObject` and `React.CSSProperties`):

```tsx
import React, { useRef, useEffect } from 'react'
```

- [ ] **Step 3: Update function signature and add refs + observer**

```tsx
export function MobileChessGrid({
  properties,
  bookings,
  from,
  to,
  onCellClick,
  onBookingClick,
  onLoadPrev,
  onLoadNext,
  scrollContainerRef,
}: Props) {
  const { data: settings } = useSettings()
  const showFullText = settings?.show_full_text ?? true
  const rowHeight = settings?.compact_mode ? 32 : 44

  const leftSentinelRef = useRef<HTMLTableCellElement>(null)
  const rightSentinelRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !leftSentinelRef.current || !rightSentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (entry.target === leftSentinelRef.current) onLoadPrev()
          if (entry.target === rightSentinelRef.current) onLoadNext()
        }
      },
      { root: container, threshold: 0.1 }
    )

    observer.observe(leftSentinelRef.current)
    observer.observe(rightSentinelRef.current)

    return () => observer.disconnect()
  }, [onLoadPrev, onLoadNext, scrollContainerRef])
```

- [ ] **Step 4: Add sentinels to the header row and ref to container**

Update the return statement — add `ref={scrollContainerRef}` to the outer div and wrap header cells with sentinels:

```tsx
  return (
    <div
      ref={scrollContainerRef}
      className="overflow-auto flex-1"
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      <table className="border-collapse" style={{ minWidth: 'max-content' }}>
        <thead>
          <tr>
            <th
              ref={leftSentinelRef}
              style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }}
              aria-hidden="true"
            />
            <th
              className="sticky left-0 z-20 bg-white border-b border-r border-gray-200 px-2 py-2 text-left text-xs text-gray-500 font-medium"
              style={{ minWidth: 100 }}
            >
              Квартира
            </th>
            {days.map(day => {
              const today = isToday(day)
              return (
                <th
                  key={day.toISOString()}
                  className={`border-b border-gray-200 px-0.5 py-1 text-center ${today ? 'bg-[#376E6F]/10' : 'bg-white'}`}
                  style={{ minWidth: 36 }}
                >
                  <div className={`text-[10px] font-medium leading-tight ${today ? 'text-[#376E6F]' : 'text-gray-400'}`}>
                    {format(day, 'EEE', { locale: ru }).slice(0, 2)}
                  </div>
                  <div className={`text-xs font-bold leading-tight ${today ? 'text-[#376E6F]' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </div>
                </th>
              )
            })}
            <th
              ref={rightSentinelRef}
              style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }}
              aria-hidden="true"
            />
          </tr>
        </thead>
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
cd /Users/rizzgy/Documents/daily-calendar && npx tsc --noEmit 2>&1 | grep MobileChessGrid
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
cd /Users/rizzgy/Documents/daily-calendar && git add src/widgets/chess-grid/MobileChessGrid.tsx && git commit -m "feat: add infinite scroll sentinels and IntersectionObserver to MobileChessGrid"
```

---

## Task 3: Add infinite scroll window state, extend logic, and scroll compensation to ChessPage

**Files:**
- Modify: `src/pages/chess/ChessPage.tsx`

- [ ] **Step 1: Update imports**

Replace the current import block at the top of `ChessPage.tsx`:

```tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  parseISO,
  differenceInCalendarDays,
} from 'date-fns'
import { useUser } from '@/features/auth/useUser'
import { useProperties } from '@/entities/property/queries'
import { useBookings } from '@/entities/booking/queries'
import { SummaryBar } from '@/widgets/summary-bar/SummaryBar'
import { ChessGrid } from '@/widgets/chess-grid/ChessGrid'
import { BookingModal } from '@/widgets/booking-modal/BookingModal'
import type { Booking } from '@/entities/booking/types'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { MobileChessGrid } from '@/widgets/chess-grid/MobileChessGrid'
```

- [ ] **Step 2: Define constants and initial window helper above the component**

Add these before the `export function ChessPage()` line:

```tsx
const COL_WIDTH = 36
const EXTEND_MONTHS = 3
const MAX_WINDOW_MONTHS = 12

function initialWindow() {
  const now = new Date()
  return {
    from: format(subMonths(startOfMonth(now), 2), 'yyyy-MM-dd'),
    to: format(endOfMonth(addMonths(now, 2)), 'yyyy-MM-dd'),
  }
}
```

- [ ] **Step 3: Replace state declarations inside the component**

Remove the old `from`, `to`, `setFrom`, `setTo` state and `handleFromChange`, `handleToChange`, `resetToCurrentMonth` functions. Replace with:

```tsx
  const { user } = useUser()
  const isMobile = useIsMobile()

  const [from, setFrom] = useState(() => initialWindow().from)
  const [to, setTo] = useState(() => initialWindow().to)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isLoadingMoreRef = useRef(false)
  const prevFromRef = useRef(from)
  const isTeleportRef = useRef(false)
  const teleportTargetRef = useRef<string | null>(null)
```

- [ ] **Step 4: Add extendPrev and extendNext functions**

```tsx
  const extendPrev = useCallback(() => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setFrom(prev => format(subMonths(parseISO(prev), EXTEND_MONTHS), 'yyyy-MM-dd'))
  }, [])

  const extendNext = useCallback(() => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setTo(prev => format(endOfMonth(addMonths(parseISO(prev), EXTEND_MONTHS)), 'yyyy-MM-dd'))
  }, [])
```

- [ ] **Step 5: Add scroll compensation effect**

This fires after any `from` change and adjusts `scrollLeft` to keep the visible content stable:

```tsx
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

- [ ] **Step 6: Add bookings-loaded effect for guard reset and window trimming**

```tsx
  const { data: bookings = [], isLoading } = useBookings(user?.id, from, to)

  useEffect(() => {
    isLoadingMoreRef.current = false

    const container = scrollContainerRef.current
    if (!container) return

    const totalDays = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1
    if (totalDays <= MAX_WINDOW_MONTHS * 31) return

    const anchorIndex = Math.floor(container.scrollLeft / COL_WIDTH)
    const totalDaysInWindow = differenceInCalendarDays(parseISO(to), parseISO(from))
    const safeIndex = Math.min(Math.max(anchorIndex, 0), totalDaysInWindow)
    const windowStart = parseISO(from)
    const anchorDateStr = format(
      new Date(windowStart.getTime() + safeIndex * 24 * 60 * 60 * 1000),
      'yyyy-MM-dd'
    )

    const trimmedFrom = format(subMonths(startOfMonth(parseISO(anchorDateStr)), 6), 'yyyy-MM-dd')
    const trimmedTo = format(endOfMonth(addMonths(parseISO(anchorDateStr), 6)), 'yyyy-MM-dd')

    if (trimmedFrom > from) setFrom(trimmedFrom)
    if (trimmedTo < to) setTo(trimmedTo)
  }, [bookings]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/rizzgy/Documents/daily-calendar && npx tsc --noEmit 2>&1 | grep ChessPage
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
cd /Users/rizzgy/Documents/daily-calendar && git add src/pages/chess/ChessPage.tsx && git commit -m "feat: add infinite scroll window state, extend/trim, and scroll compensation to ChessPage"
```

---

## Task 4: Replace date range pickers with teleport month picker and wire up all props

**Files:**
- Modify: `src/pages/chess/ChessPage.tsx`

- [ ] **Step 1: Add teleport function**

After the `extendNext` function, add:

```tsx
  function teleportToMonth(yearMonth: string) {
    if (!yearMonth) return
    const [year, month] = yearMonth.split('-').map(Number)
    const target = new Date(year, month - 1, 1)
    const newFrom = format(subMonths(startOfMonth(target), 2), 'yyyy-MM-dd')
    const newTo = format(endOfMonth(addMonths(target, 2)), 'yyyy-MM-dd')
    isTeleportRef.current = true
    teleportTargetRef.current = format(target, 'yyyy-MM-dd')
    setFrom(newFrom)
    setTo(newTo)
  }

  function resetToCurrentMonth() {
    isTeleportRef.current = true
    teleportTargetRef.current = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const w = initialWindow()
    setFrom(w.from)
    setTo(w.to)
  }
```

- [ ] **Step 2: Add teleport scroll effect**

After the scroll compensation effect, add:

```tsx
  useEffect(() => {
    const target = teleportTargetRef.current
    const container = scrollContainerRef.current
    if (!target || !container) return
    const dayOffset = differenceInCalendarDays(parseISO(target), parseISO(from))
    container.scrollLeft = Math.max(0, dayOffset * COL_WIDTH)
    teleportTargetRef.current = null
    isTeleportRef.current = false
  }, [from, to])
```

- [ ] **Step 3: Replace the date picker JSX with a teleport month picker**

Remove the entire `{/* Date range picker */}` block — it starts with `<div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b` and contains the "С", "По" labels and "Текущий месяц" button. Replace with:

```tsx
      {/* Teleport date picker */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200">
        <label className="text-xs text-gray-400 flex-shrink-0">Перейти к</label>
        <input
          type="month"
          defaultValue={format(new Date(), 'yyyy-MM')}
          onChange={e => teleportToMonth(e.target.value)}
          className="flex-1 min-w-0 text-sm text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#376E6F]/30 focus:border-[#376E6F]"
        />
        <button
          onClick={resetToCurrentMonth}
          className="text-xs text-[#376E6F] hover:underline flex-shrink-0 py-1.5 px-1"
        >
          Сегодня
        </button>
      </div>
```

- [ ] **Step 4: Update the ChessGrid and MobileChessGrid render calls**

Remove `currentMonth` prop (no longer exists). Add `onLoadPrev`, `onLoadNext`, `scrollContainerRef`:

```tsx
      ) : isMobile ? (
        <MobileChessGrid
          properties={properties}
          bookings={bookings}
          from={from}
          to={to}
          onCellClick={handleCellClick}
          onBookingClick={handleBookingClick}
          onLoadPrev={extendPrev}
          onLoadNext={extendNext}
          scrollContainerRef={scrollContainerRef}
        />
      ) : (
        <ChessGrid
          properties={properties}
          bookings={bookings}
          from={from}
          to={to}
          onCellClick={handleCellClick}
          onBookingClick={handleBookingClick}
          onLoadPrev={extendPrev}
          onLoadNext={extendNext}
          scrollContainerRef={scrollContainerRef}
        />
      )}
```

- [ ] **Step 5: Verify full project compiles**

```bash
cd /Users/rizzgy/Documents/daily-calendar && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/rizzgy/Documents/daily-calendar && git add src/pages/chess/ChessPage.tsx && git commit -m "feat: replace date range pickers with teleport month picker in шахматка"
```

---

## Task 5: Update e2e tests to match new UX

**Files:**
- Modify: `tests/e2e/chess.spec.ts`

The existing tests reference "‹"/"›" navigation buttons and "Сегодня" which no longer exist or changed. Replace the entire file:

- [ ] **Step 1: Rewrite chess.spec.ts**

```typescript
import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'
import { format, addMonths } from 'date-fns'

test.describe('Шахматка', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/')
  })

  test('страница загружается и показывает дни текущего месяца', async ({ page }) => {
    const today = new Date()
    const dayNum = String(today.getDate())
    // The grid header shows day numbers — today's day number should be visible
    await expect(page.locator('thead').getByText(dayNum).first()).toBeVisible()
  })

  test('кнопка "Сегодня" присутствует', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Сегодня' })).toBeVisible()
  })

  test('инпут "Перейти к" присутствует', async ({ page }) => {
    await expect(page.getByLabel('Перейти к')).toBeVisible()
  })

  test('teleport: выбор месяца показывает дни выбранного месяца', async ({ page }) => {
    const nextMonth = addMonths(new Date(), 1)
    const yearMonth = format(nextMonth, 'yyyy-MM')
    const lastDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0)
    const lastDay = String(lastDayOfNextMonth.getDate())

    await page.getByLabel('Перейти к').fill(yearMonth)
    await page.getByLabel('Перейти к').dispatchEvent('change')

    await expect(page.locator('thead').getByText(lastDay).first()).toBeVisible()
  })

  test('кнопка "Сегодня" возвращает к текущему месяцу', async ({ page }) => {
    const today = new Date()
    const nextMonth = addMonths(today, 3)
    const yearMonth = format(nextMonth, 'yyyy-MM')

    // Teleport away
    await page.getByLabel('Перейти к').fill(yearMonth)
    await page.getByLabel('Перейти к').dispatchEvent('change')

    // Come back
    await page.getByRole('button', { name: 'Сегодня' }).click()

    const dayNum = String(today.getDate())
    await expect(page.locator('thead').getByText(dayNum).first()).toBeVisible()
  })
})
```

- [ ] **Step 2: Verify tests can be found by Playwright**

```bash
cd /Users/rizzgy/Documents/daily-calendar && npx playwright test tests/e2e/chess.spec.ts --list 2>&1
```

Expected: lists 4 tests with no parse errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/rizzgy/Documents/daily-calendar && git add tests/e2e/chess.spec.ts && git commit -m "test: update chess e2e tests for infinite scroll + teleport UX"
```

---

## Task 6: Final type check and smoke test

**Files:** none new

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/rizzgy/Documents/daily-calendar && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 2: Build check**

```bash
cd /Users/rizzgy/Documents/daily-calendar && npm run build 2>&1 | tail -20
```

Expected: `✓ built in` message, no errors.

- [ ] **Step 3: Start dev server and manually verify**

```bash
cd /Users/rizzgy/Documents/daily-calendar && npm run dev
```

Open the app, navigate to шахматка and verify:
- Grid shows ~5 months of dates on load
- Scrolling right reaches the end and triggers more dates loading
- Scrolling left reaches the start and triggers earlier dates loading
- "Перейти к" month picker jumps to the selected month
- "Сегодня" button resets to current month ±2

- [ ] **Step 4: Stop dev server (Ctrl+C)**
