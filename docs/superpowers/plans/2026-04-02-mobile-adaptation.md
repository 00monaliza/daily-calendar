# Mobile Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полная мобильная адаптация (320–768px) дашборда аренды — Bottom Nav, мобильная шахматка, Bottom Sheet для модалок — без изменения бизнес-логики и десктопной версии.

**Architecture:** Новые мобильные компоненты изолированы от десктопных. Хук `useIsMobile` переключает рендер в `AppLayout` и ключевых виджетах. Tailwind breakpoints: default = mobile, `md:` = desktop.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, react-router-dom v7, date-fns

---

## File Map

**Create:**
- `src/shared/hooks/useIsMobile.ts`
- `src/widgets/bottom-nav/BottomNav.tsx`
- `src/widgets/bottom-sheet/BottomSheet.tsx`
- `src/widgets/chess-grid/MobileChessGrid.tsx`

**Modify:**
- `src/app/styles/global.css` — mobile scroll/touch resets
- `src/app/providers/AppLayout.tsx` — add BottomNav, hide TopNav on mobile
- `src/widgets/top-nav/TopNav.tsx` — скрыть на мобайле
- `src/widgets/summary-bar/SummaryBar.tsx` — 2 колонки на мобайле
- `src/pages/chess/ChessPage.tsx` — переключение ChessGrid/MobileChessGrid
- `src/widgets/booking-modal/BookingModal.tsx` — BottomSheet на мобайле
- `src/pages/properties/PropertiesPage.tsx` — BottomSheet для PropertyModal
- `src/pages/finances/FinancesPage.tsx` — карточки и 2-col KPI
- `src/pages/guests/GuestsPage.tsx` — карточки вместо таблицы

---

### Task 1: `useIsMobile` хук

**Files:**
- Create: `src/shared/hooks/useIsMobile.ts`

- [ ] **Step 1: Создать хук**

```ts
// src/shared/hooks/useIsMobile.ts
import { useEffect, useState } from 'react'

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])

  return isMobile
}
```

- [ ] **Step 2: Проверить в браузере**

Запусти `npm run dev`, открой DevTools → мобильный эмулятор (iPhone 12). Хук используем в следующих задачах.

- [ ] **Step 3: Commit**

```bash
git add src/shared/hooks/useIsMobile.ts
git commit -m "feat(mobile): add useIsMobile hook"
```

---

### Task 2: `BottomSheet` компонент

**Files:**
- Create: `src/widgets/bottom-sheet/BottomSheet.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
// src/widgets/bottom-sheet/BottomSheet.tsx
import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export function BottomSheet({ open, onClose, title, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Закрытие по Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Блокировка скролла body
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative bg-white rounded-t-2xl shadow-xl max-h-[90vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-8 h-1 bg-gray-300 rounded-full" />
        </div>
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>
        )}
        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/widgets/bottom-sheet/BottomSheet.tsx
git commit -m "feat(mobile): add BottomSheet component"
```

---

### Task 3: `BottomNav` + FAB

**Files:**
- Create: `src/widgets/bottom-nav/BottomNav.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
// src/widgets/bottom-nav/BottomNav.tsx
import { NavLink } from 'react-router-dom'

interface Props {
  onAddBooking: () => void
}

const tabs = [
  { to: '/', end: true, icon: GridIcon, label: 'Шахматка' },
  { to: '/properties', end: false, icon: BuildingIcon, label: 'Квартиры' },
  { to: '/finances', end: false, icon: ChartIcon, label: 'Финансы' },
  { to: '/guests', end: false, icon: PersonIcon, label: 'Гости' },
]

export function BottomNav({ onAddBooking }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-14 relative">
        {tabs.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-h-[44px] ${
                isActive ? 'text-[#376E6F]' : 'text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* FAB */}
        <button
          onClick={onAddBooking}
          className="absolute -top-5 right-4 w-12 h-12 bg-[#376E6F] text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-[#1C3334] transition-colors active:scale-95"
          aria-label="Добавить бронь"
        >
          +
        </button>
      </div>
    </nav>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function BuildingIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 21V9h6v12" />
      <path d="M9 9h6" />
    </svg>
  )
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/widgets/bottom-nav/BottomNav.tsx
git commit -m "feat(mobile): add BottomNav with FAB"
```

---

### Task 4: Интеграция BottomNav в AppLayout

**Files:**
- Modify: `src/app/providers/AppLayout.tsx`
- Modify: `src/widgets/top-nav/TopNav.tsx`
- Modify: `src/app/styles/global.css`

- [ ] **Step 1: Обновить `AppLayout.tsx`**

```tsx
// src/app/providers/AppLayout.tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { TopNav } from '@/widgets/top-nav/TopNav'
import { BottomNav } from '@/widgets/bottom-nav/BottomNav'
import { BookingModal } from '@/widgets/booking-modal/BookingModal'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { useProperties } from '@/entities/property/queries'
import { useUser } from '@/features/auth/useUser'

export function AppLayout() {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const { data: properties = [] } = useProperties(user?.id)
  const [fabModalOpen, setFabModalOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className={`flex-1 ${isMobile ? 'pb-16' : ''}`}>
        <Outlet />
      </main>
      {isMobile && (
        <BottomNav onAddBooking={() => setFabModalOpen(true)} />
      )}
      {fabModalOpen && (
        <BookingModal
          booking={null}
          properties={properties}
          prefillDate={null}
          prefillPropertyId={null}
          onClose={() => setFabModalOpen(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Скрыть `TopNav` на мобайле**

В `src/widgets/top-nav/TopNav.tsx` заменить первую строку `<nav ...>` на:

```tsx
// Было:
<nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">

// Стало:
<nav className="hidden md:flex bg-white border-b border-gray-200 px-4 py-3 items-center justify-between">
```

- [ ] **Step 3: Добавить mobile-resets в `global.css`**

Добавить в конец файла `src/app/styles/global.css`:

```css
/* Mobile touch & scroll */
html {
  -webkit-tap-highlight-color: transparent;
}

.overflow-x-scroll {
  -webkit-overflow-scrolling: touch;
}
```

- [ ] **Step 4: Проверить в браузере**

В DevTools → iPhone 12:
- TopNav не виден
- BottomNav с 4 табами + FAB «+» отображается внизу
- Переключение между страницами работает
- FAB открывает форму брони

- [ ] **Step 5: Commit**

```bash
git add src/app/providers/AppLayout.tsx src/widgets/top-nav/TopNav.tsx src/app/styles/global.css
git commit -m "feat(mobile): integrate BottomNav into AppLayout, hide TopNav on mobile"
```

---

### Task 5: `MobileChessGrid`

**Files:**
- Create: `src/widgets/chess-grid/MobileChessGrid.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
// src/widgets/chess-grid/MobileChessGrid.tsx
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isToday, parseISO, isSameDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Property } from '@/entities/property/types'
import type { Booking, BookingWithProperty } from '@/entities/booking/types'

interface Props {
  properties: Property[]
  bookings: (Booking | BookingWithProperty)[]
  currentMonth: Date
  onCellClick: (date: string, propertyId: string) => void
  onBookingClick: (booking: Booking) => void
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 55, g: 110, b: 111 }
}

export function MobileChessGrid({ properties, bookings, currentMonth, onCellClick, onBookingClick }: Props) {
  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  const bookingMap = new Map<string, Map<string, Booking>>()
  for (const booking of bookings) {
    if (!bookingMap.has(booking.property_id)) {
      bookingMap.set(booking.property_id, new Map())
    }
    const propMap = bookingMap.get(booking.property_id)!
    const checkIn = parseISO(booking.check_in)
    const checkOut = parseISO(booking.check_out)
    for (const day of eachDayOfInterval({ start: checkIn, end: checkOut })) {
      propMap.set(format(day, 'yyyy-MM-dd'), booking as Booking)
    }
  }

  if (properties.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-gray-400 text-sm py-16 px-4 text-center">
        Добавьте квартиры, чтобы увидеть шахматку
      </div>
    )
  }

  return (
    <div
      className="overflow-auto flex-1"
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      <table className="border-collapse" style={{ minWidth: 'max-content' }}>
        <thead>
          <tr>
            <th
              className="sticky left-0 z-20 bg-white border-b border-r border-gray-200 px-2 py-2 text-left text-xs text-gray-500 font-medium"
              style={{ minWidth: 80 }}
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
          </tr>
        </thead>
        <tbody>
          {properties.map(property => {
            const propBookings = bookingMap.get(property.id) ?? new Map<string, Booking>()
            const rgb = hexToRgb(property.color)

            return (
              <tr key={property.id}>
                <td
                  className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-2 py-0"
                  style={{ minWidth: 80 }}
                >
                  <div className="flex items-center gap-1.5 py-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: property.color }}
                    />
                    <span className="text-xs font-medium text-gray-800 truncate" style={{ maxWidth: 56 }}>
                      {property.name}
                    </span>
                  </div>
                </td>
                {days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const booking = propBookings.get(dateStr)
                  const today = isToday(day)

                  if (booking) {
                    const isStart = isSameDay(parseISO(booking.check_in), day)
                    const isEnd = isSameDay(parseISO(booking.check_out), day)

                    return (
                      <td
                        key={dateStr}
                        className={`border-b border-gray-100 p-0 cursor-pointer relative ${today ? 'border-l-2 border-l-[#376E6F]' : ''}`}
                        style={{ height: 44 }}
                        onClick={() => onBookingClick(booking)}
                      >
                        <div
                          className="absolute inset-y-0.5 flex items-center overflow-hidden"
                          style={{
                            left: isStart ? '2px' : '0',
                            right: isEnd ? '2px' : '0',
                            backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`,
                            borderLeft: isStart ? `3px solid ${property.color}` : 'none',
                            borderRadius: isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : '0',
                          }}
                        >
                          {isStart && (
                            <span
                              className="text-[10px] font-medium px-1 truncate"
                              style={{ color: property.color }}
                            >
                              {booking.guest_name.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  }

                  return (
                    <td
                      key={dateStr}
                      className={`border border-gray-200 cursor-pointer active:bg-[#376E6F]/20 transition-colors ${today ? 'border-l-2 border-l-[#376E6F] bg-[#376E6F]/5' : ''}`}
                      style={{ height: 44 }}
                      onClick={() => onCellClick(dateStr, property.id)}
                    />
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/widgets/chess-grid/MobileChessGrid.tsx
git commit -m "feat(mobile): add MobileChessGrid with sticky columns and touch scroll"
```

---

### Task 6: Интеграция MobileChessGrid в ChessPage

**Files:**
- Modify: `src/pages/chess/ChessPage.tsx`

- [ ] **Step 1: Обновить `ChessPage.tsx`**

Добавить импорты в начало файла:

```tsx
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { MobileChessGrid } from '@/widgets/chess-grid/MobileChessGrid'
```

Добавить хук после существующих useState:

```tsx
const isMobile = useIsMobile()
```

Заменить блок с `ChessGrid` (внутри `{isLoading ? ... : (...)}`) на:

```tsx
{isLoading ? (
  <div className="flex items-center justify-center flex-1">
    <div className="w-8 h-8 border-4 border-[#376E6F] border-t-transparent rounded-full animate-spin" />
  </div>
) : isMobile ? (
  <MobileChessGrid
    properties={properties}
    bookings={bookings}
    currentMonth={currentMonth}
    onCellClick={handleCellClick}
    onBookingClick={handleBookingClick}
  />
) : (
  <ChessGrid
    properties={properties}
    bookings={bookings}
    currentMonth={currentMonth}
    onCellClick={handleCellClick}
    onBookingClick={handleBookingClick}
  />
)}
```

- [ ] **Step 2: Адаптировать навигацию по месяцам и SummaryBar под мобайл**

В блоке навигации по месяцам заменить `className` враппера:

```tsx
// Было:
<div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">

// Стало:
<div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
```

- [ ] **Step 3: Проверить в браузере (iPhone 12)**

- Шахматка отображается с закреплённой колонкой квартир
- Горизонтальный скролл работает плавно
- Тап на бронь открывает форму
- Тап на пустую ячейку открывает форму новой брони
- На десктопе ничего не изменилось

- [ ] **Step 4: Commit**

```bash
git add src/pages/chess/ChessPage.tsx
git commit -m "feat(mobile): switch to MobileChessGrid on small screens"
```

---

### Task 7: BookingModal → BottomSheet на мобайле

**Files:**
- Modify: `src/widgets/booking-modal/BookingModal.tsx`

- [ ] **Step 1: Читать текущий файл целиком перед правкой**

```bash
cat src/widgets/booking-modal/BookingModal.tsx
```

- [ ] **Step 2: Добавить импорты и хук**

В начало файла добавить:

```tsx
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { BottomSheet } from '@/widgets/bottom-sheet/BottomSheet'
```

В начало функции `BookingModal` добавить:

```tsx
const isMobile = useIsMobile()
```

- [ ] **Step 3: Обернуть форму в условный рендер**

Найти в файле возвращаемый JSX. Он начинается с:
```tsx
return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" ...>
```

Заменить весь `return (...)` на:

```tsx
const formContent = (
  <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
    {/* --- вставить сюда весь существующий контент формы из <form> --- */}
  </form>
)

if (isMobile) {
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={booking ? 'Редактировать бронь' : 'Новая бронь'}
    >
      {formContent}
    </BottomSheet>
  )
}

return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
    <div
      className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">
          {booking ? 'Редактировать бронь' : 'Новая бронь'}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
      </div>
      {formContent}
    </div>
  </div>
)
```

> **Важно:** `formContent` — это только `<form>` элемент со всем содержимым. Шапку с заголовком десктопа оставить снаружи (как показано выше).

- [ ] **Step 4: Проверить**

Мобайл: тап на ячейку → sheet выезжает снизу, форма скроллится, закрытие по backdrop и ✕.
Десктоп: форма по-прежнему по центру экрана.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/booking-modal/BookingModal.tsx
git commit -m "feat(mobile): BookingModal uses BottomSheet on mobile"
```

---

### Task 8: PropertyModal → BottomSheet на мобайле

**Files:**
- Modify: `src/pages/properties/PropertiesPage.tsx`

- [ ] **Step 1: Добавить импорты в `PropertiesPage.tsx`**

```tsx
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { BottomSheet } from '@/widgets/bottom-sheet/BottomSheet'
```

- [ ] **Step 2: Обновить `PropertyModal`**

В начало функции `PropertyModal` добавить:

```tsx
const isMobile = useIsMobile()
```

Найти `return (` в `PropertyModal`. Текущий JSX начинается с:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
```

Заменить на:

```tsx
const formContent = (
  <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
    {/* --- весь существующий контент формы --- */}
  </form>
)

if (isMobile) {
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={property ? 'Редактировать квартиру' : 'Добавить квартиру'}
    >
      {formContent}
    </BottomSheet>
  )
}

return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">
          {property ? 'Редактировать квартиру' : 'Добавить квартиру'}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
      </div>
      {formContent}
    </div>
  </div>
)
```

- [ ] **Step 3: Увеличить зоны касания кнопок действий карточки**

В `PropertiesPage` найти блок с кнопками `Изменить / Архивировать / Удалить`:

```tsx
// Было:
<div className="flex items-center gap-2">
  <button onClick={() => openEdit(property)} className="text-xs text-[#376E6F] hover:underline">
    Изменить
  </button>
  ...
```

Заменить на:

```tsx
<div className="flex items-center gap-1">
  <button
    onClick={() => openEdit(property)}
    className="text-xs text-[#376E6F] hover:underline px-2 py-2 min-h-[44px] flex items-center"
  >
    Изменить
  </button>
  <button
    onClick={() => handleToggleActive(property)}
    className="text-xs text-gray-400 hover:text-gray-600 hover:underline px-2 py-2 min-h-[44px] flex items-center"
  >
    {property.is_active ? 'Архив' : 'Восстановить'}
  </button>
  <button
    onClick={() => {
      if (confirm('Удалить квартиру и все её брони?')) {
        deleteProperty.mutate(property.id)
      }
    }}
    className="text-xs text-red-400 hover:text-red-600 hover:underline px-2 py-2 min-h-[44px] flex items-center"
  >
    Удалить
  </button>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/properties/PropertiesPage.tsx
git commit -m "feat(mobile): PropertyModal uses BottomSheet on mobile, larger touch targets"
```

---

### Task 9: SummaryBar — мобильная адаптация

**Files:**
- Modify: `src/widgets/summary-bar/SummaryBar.tsx`

- [ ] **Step 1: Сделать 2 колонки на мобайле**

Заменить класс враппера сетки:

```tsx
// Было:
<div className="grid grid-cols-4 gap-4 px-4 py-3 bg-white border-b border-gray-200">

// Стало:
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3 bg-white border-b border-gray-200">
```

Уменьшить шрифт метрики на мобайле:

```tsx
// Было:
<span className={`text-xl font-bold ${m.color}`}>{m.value}</span>

// Стало:
<span className={`text-lg md:text-xl font-bold ${m.color}`}>{m.value}</span>
```

- [ ] **Step 2: Commit**

```bash
git add src/widgets/summary-bar/SummaryBar.tsx
git commit -m "feat(mobile): SummaryBar 2-col layout on mobile"
```

---

### Task 10: FinancesPage — мобильная адаптация

**Files:**
- Modify: `src/pages/finances/FinancesPage.tsx`

- [ ] **Step 1: KPI карточки 2-col на мобайле**

```tsx
// Было:
<div className="grid grid-cols-3 gap-4 mb-6">

// Стало:
<div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
```

Текст в карточках:

```tsx
// Было:
<div className={`text-2xl font-bold ${m.color}`}>{m.value.toLocaleString()} ₸</div>

// Стало:
<div className={`text-xl md:text-2xl font-bold ${m.color}`}>{m.value.toLocaleString()} ₸</div>
```

- [ ] **Step 2: Таблица по квартирам → карточки на мобайле**

Найти блок с `<table className="w-full">` (таблица доходов по квартирам).

Заменить весь блок `<div className="bg-white rounded-xl border...">` с таблицей на:

```tsx
<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
  {/* Десктоп: таблица */}
  <table className="w-full hidden md:table">
    <thead>
      <tr className="border-b border-gray-200 bg-gray-50">
        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Квартира</th>
        <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Доход</th>
        <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Расходы</th>
        <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Прибыль</th>
      </tr>
    </thead>
    <tbody>
      {stats.map(row => (
        <tr key={row.property.id} className="border-b border-gray-100 last:border-0">
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: row.property.color }} />
              <span className="text-sm font-medium text-gray-800">{row.property.name}</span>
            </div>
          </td>
          <td className="text-right px-4 py-3 text-sm text-emerald-600">{row.income.toLocaleString()} ₸</td>
          <td className="text-right px-4 py-3 text-sm text-red-500">{row.expenses.toLocaleString()} ₸</td>
          <td className={`text-right px-4 py-3 text-sm font-medium ${row.profit >= 0 ? 'text-[#376E6F]' : 'text-red-600'}`}>
            {row.profit.toLocaleString()} ₸
          </td>
        </tr>
      ))}
    </tbody>
  </table>

  {/* Мобайл: карточки */}
  <div className="md:hidden divide-y divide-gray-100">
    {stats.map(row => (
      <div key={row.property.id} className="p-4" style={{ borderLeft: `3px solid ${row.property.color}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: row.property.color }} />
            <span className="text-sm font-semibold text-gray-800">{row.property.name}</span>
          </div>
          <span className={`text-sm font-bold ${row.profit >= 0 ? 'text-[#376E6F]' : 'text-red-600'}`}>
            {row.profit >= 0 ? '+' : ''}{row.profit.toLocaleString()} ₸
          </span>
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span>Доход: <span className="text-emerald-600 font-medium">{row.income.toLocaleString()} ₸</span></span>
          <span>Расходы: <span className="text-red-500 font-medium">{row.expenses.toLocaleString()} ₸</span></span>
        </div>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/finances/FinancesPage.tsx
git commit -m "feat(mobile): FinancesPage 2-col KPI and card list on mobile"
```

---

### Task 11: GuestsPage — мобильная адаптация

**Files:**
- Modify: `src/pages/guests/GuestsPage.tsx`

- [ ] **Step 1: Заменить таблицу на карточки + аккордеон**

Найти блок `<div className="grid gap-4 md:grid-cols-2">` и заменить целиком на:

```tsx
{/* Мобайл: список карточек с аккордеоном */}
<div className="md:hidden space-y-2">
  {filtered.length === 0 ? (
    <div className="text-center text-gray-400 text-sm py-8">Гостей не найдено</div>
  ) : filtered.map(guest => (
    <div key={guest.name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-left min-h-[56px]"
        onClick={() => setSelectedGuest(guest.name === selectedGuest ? null : guest.name)}
      >
        <div>
          <div className="font-medium text-sm text-gray-800">{guest.name}</div>
          {guest.phone && <div className="text-xs text-gray-400">{guest.phone}</div>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{guest.count} броней</span>
          <span className="text-gray-400 text-sm">{selectedGuest === guest.name ? '▴' : '▾'}</span>
        </div>
      </button>
      {selectedGuest === guest.name && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <div className="space-y-2">
            {guest.bookings.map((b, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-2 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">{b.properties?.name ?? '—'}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    b.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                    b.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {b.payment_status === 'paid' ? 'Оплачено' : b.payment_status === 'partial' ? 'Частично' : 'Ожидает'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{b.check_in} → {b.check_out}</div>
                <div className="text-xs font-medium text-[#376E6F]">{b.total_price.toLocaleString()} ₸</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  ))}
</div>

{/* Десктоп: оригинальная таблица */}
<div className="hidden md:grid gap-4 md:grid-cols-2">
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Гость</th>
          <th className="text-center text-xs text-gray-500 font-medium px-4 py-3">Броней</th>
          <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Последний заезд</th>
        </tr>
      </thead>
      <tbody>
        {filtered.length === 0 ? (
          <tr><td colSpan={3} className="text-center text-gray-400 text-sm py-8">Гостей не найдено</td></tr>
        ) : filtered.map(guest => (
          <tr
            key={guest.name}
            className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${selectedGuest === guest.name ? 'bg-[#376E6F]/5' : 'hover:bg-gray-50'}`}
            onClick={() => setSelectedGuest(guest.name === selectedGuest ? null : guest.name)}
          >
            <td className="px-4 py-3">
              <div className="font-medium text-sm text-gray-800">{guest.name}</div>
              {guest.phone && <div className="text-xs text-gray-400">{guest.phone}</div>}
            </td>
            <td className="text-center px-4 py-3 text-sm text-gray-600">{guest.count}</td>
            <td className="text-right px-4 py-3 text-xs text-gray-400">{guest.lastCheckIn}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  {selectedGuestData && (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-800 mb-1">{selectedGuestData.name}</h3>
      {selectedGuestData.phone && <p className="text-sm text-gray-500 mb-3">{selectedGuestData.phone}</p>}
      <h4 className="text-xs font-medium text-gray-500 mb-2">История броней</h4>
      <div className="space-y-2">
        {selectedGuestData.bookings.map((b, i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">{b.properties?.name ?? '—'}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                b.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                b.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {b.payment_status === 'paid' ? 'Оплачено' : b.payment_status === 'partial' ? 'Частично' : 'Ожидает'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{b.check_in} → {b.check_out}</div>
            <div className="text-xs font-medium text-[#376E6F]">{b.total_price.toLocaleString()} ₸</div>
          </div>
        ))}
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/guests/GuestsPage.tsx
git commit -m "feat(mobile): GuestsPage accordion cards on mobile"
```

---

### Task 12: Финальная проверка и `.gitignore`

- [ ] **Step 1: Добавить `.superpowers/` в `.gitignore`**

```bash
echo ".superpowers/" >> .gitignore
git add .gitignore
```

- [ ] **Step 2: Полный прогон в браузере на мобайле (iPhone 12)**

Открыть `npm run dev`, DevTools → iPhone 12. Проверить:
- [ ] Bottom Nav переключает все 4 страницы
- [ ] FAB открывает форму брони
- [ ] Шахматка скроллится горизонтально, квартиры закреплены слева
- [ ] Тап на бронь → Bottom Sheet
- [ ] Тап на пустую ячейку → Bottom Sheet с новой бронью
- [ ] Квартиры — кнопки кликабельны (≥44px)
- [ ] Финансы — 2 KPI в ряд, карточки по квартирам
- [ ] Гости — аккордеон раскрывается
- [ ] Десктоп (1280px) — всё выглядит как раньше, TopNav виден

- [ ] **Step 3: Финальный коммит**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to .gitignore"
```
