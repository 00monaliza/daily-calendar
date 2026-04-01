# Mobile Adaptation Design — Pogostim

**Date:** 2026-04-02  
**Stack:** React 19, TypeScript, Tailwind CSS v4, Vite

## Summary

Full mobile adaptation (320–768px) of the rental management dashboard using a mobile-first, isolated-component approach. Desktop stays untouched. No business logic changes.

## Decisions

| Element | Choice |
|---|---|
| Navigation | Bottom Navigation Bar (4 tabs) + FAB «+» |
| Chess grid | Sticky left column + horizontal scroll + swipe |
| Booking/Property modal | Bottom Sheet on mobile |
| Approach | New mobile components + `useIsMobile` hook |

## Architecture

### New files

```
src/
  shared/hooks/useIsMobile.ts           # window.innerWidth < 768, resize listener
  widgets/bottom-nav/BottomNav.tsx      # 4-tab bar: Шахматка/Квартиры/Финансы/Гости
  widgets/bottom-sheet/BottomSheet.tsx  # reusable slide-up sheet with drag handle
  widgets/chess-grid/MobileChessGrid.tsx
```

### Modified files (minimal — ≤10 lines each)

```
src/app/providers/AppLayout.tsx         # show BottomNav on mobile, hide TopNav
src/widgets/top-nav/TopNav.tsx          # add md:flex hidden on mobile
src/widgets/booking-modal/BookingModal.tsx   # wrap in BottomSheet on mobile
src/pages/properties/PropertiesPage.tsx # wrap PropertyModal in BottomSheet on mobile
src/pages/chess/ChessPage.tsx           # switch ChessGrid / MobileChessGrid
src/widgets/summary-bar/SummaryBar.tsx  # 2-col grid on mobile (was 4-col)
src/pages/finances/FinancesPage.tsx     # KPI cards 2-col, table → card list on mobile
src/pages/guests/GuestsPage.tsx         # table → card list on mobile
```

## Component Specs

### `useIsMobile`
```ts
// Returns true when viewport < 768px
// Uses window.innerWidth on mount + ResizeObserver
```

### `BottomNav`
- Fixed bottom bar, height 56px, z-index 50
- 4 items: Шахматка (grid icon), Квартиры (building), Финансы (chart), Гости (person)
- Active state: filled icon + teal color (`#376E6F`)
- Safe area padding for iOS (`env(safe-area-inset-bottom)`)
- FAB: absolute positioned above bar, right side, `+` button → opens BookingModal

### `BottomSheet`
- Slides up from bottom with CSS transition
- Drag handle at top center (32×4px pill)
- Backdrop click closes sheet
- Max height 90vh, scrollable content
- Props: `open`, `onClose`, `title`, `children`

### `MobileChessGrid`
- Same data props as `ChessGrid` (drop-in replacement)
- CSS: `overflow-x: auto; -webkit-overflow-scrolling: touch`
- Sticky left column: property name + color dot, width 80px, `position: sticky; left: 0; z-index: 10`
- Sticky header row: dates, `position: sticky; top: 0; z-index: 10`
- Cell height: 44px (touch target minimum)
- Booking tap → opens BottomSheet with booking info
- Empty cell tap → opens BottomSheet with new booking form
- Month navigation: swipe left/right via touch events (or buttons)

### `SummaryBar` (mobile)
- `grid-cols-2` instead of `grid-cols-4` on mobile
- Smaller font sizes

### Finances page (mobile)
- KPI cards: `grid-cols-2` (was `grid-cols-3`)
- Per-property table → card list with colored left border

### Guests page (mobile)
- Guest list as cards instead of table rows
- Guest detail expands inline (accordion) instead of side panel

### Properties page (mobile)
- Cards already work well — keep, just increase tap target
- Action buttons (Изменить / Архив / Удалить) → horizontal row with proper spacing

## Styling Rules
- All mobile-specific styles use Tailwind breakpoint prefix approach: default = mobile, `md:` = desktop
- No changes to existing desktop classes
- Touch targets: minimum 44×44px everywhere
- Use `env(safe-area-inset-bottom)` for bottom nav on iOS notch devices

## What Does NOT Change
- All Supabase queries, mutations, React Query hooks
- Business logic in ChessPage, FinancesPage, GuestsPage
- Desktop layout (TopNav + existing components)
- Authentication flow
- Data types and entity models
