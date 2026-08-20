# Frontend Design Direction — Staff Scheduling Screens

Date: 2026-08-21
Scope: manager `/staff` grid + employee `staff.pogostim.kz` portal

## Framing

pogostim.kz is a working mobile PWA for a solo operator, not a
marketing surface — dense stat tiles (`text-[10px]`/`text-sm
font-bold`), system font stack, white `rounded-xl` cards on
`#f8fafc`, teal (`#376E6F`) used sparingly to mark the one number that
matters (revenue, brand actions). The correct creative choice for
these two screens is **not** a new visual identity — it's extending
this exact idiom with precision, because that's what actually serves
a manager glancing at a schedule between guest check-ins and a server
checking their shift on a phone between tables. Introducing new type
pairings or a different palette here would read as a seam between
"the app" and "this new tab," which is the opposite of what a
Clockster-replacement bolted onto an existing tool needs.

The one place I'm taking a deliberate, justified risk is making each
screen answer its single most-asked question at a glance, rather than
just being a data table:

- **Manager grid's signature element — the coverage strip.** A thin
  bar under each day-column header showing how many staff are
  scheduled to work that day (a mini bar, same idea as a sparkline).
  This isn't decoration — "are we short-staffed Tuesday?" is the real
  question a manager scans the whole grid for, and right now the
  reference screenshot only answers it by mentally counting colored
  cells. Encoding it directly in the header turns a scan into a
  glance.
- **Employee portal's signature element — the Next Shift card.** The
  single thing a server opens this app to check is "when do I work
  next." Put that as a large, unmissable card above the schedule
  list, not buried as just another row.

Everything else stays quiet and matches the existing app exactly.

## Type & color (extending existing tokens, not replacing them)

- Font: unchanged — the existing system stack
  (`-apple-system, 'Segoe UI', Roboto, sans-serif`). No new typeface.
- Numbers (hours totals, times): add `font-variant-numeric:
  tabular-nums` via Tailwind's `tabular-nums` class wherever times or
  hour totals sit in a column, so `07:38` / `21:53` / `9.0` align
  vertically — the existing app doesn't need this elsewhere (no
  stacked numeric columns), but a schedule grid lives or dies on
  columns lining up.
- Shift-status colors: exactly the scale already proposed in the
  design-system audit (work=teal-tinted `#EEF6F6`/`#376E6F`,
  day_off=neutral gray, vacation=purple, sick=red) — no changes.
- Teal stays reserved for the one emphasized number per screen: the
  manager's weekly total-hours figure per employee, and the employee's
  "Next Shift" time. Every other numeral stays `text-gray-800`, exactly
  matching how `GuestsPage` reserves teal for revenue only.

## Layout — Manager grid (`/staff`)

```
┌─ Staff Schedule ────────────────────────────── [< Week of Aug 17 >] ─┐
│                        Mon 17  Tue 18  Wed 19  Thu 20  Fri 21  ...   │
│                        ▂▂▂▂▂   ▂▂▂▂▂▂  ▂▂▂     ▂▂▂▂    ▂▂▂▂▂▂  ...   │ ← coverage strip
├────────────────────────────────────────────────────────────────────┤
│ ⣿⣿  Natalya B.        OFF     OFF     08–17   08–17   08–17   45.0  │
│      Supervisor                                                     │
├────────────────────────────────────────────────────────────────────┤
│ ⣿⣿  Zarina N.         08–17   08–17   OFF     OFF     15–00   45.0  │
│      Supervisor                                                     │
└────────────────────────────────────────────────────────────────────┘
```

- Reuse `ChessGrid`'s sticky first column + horizontal scroll exactly
  (same `COL_WIDTH` mechanics, same drag-handle affordance for
  reordering employees).
- Row identity: name in `text-sm font-semibold text-gray-800`,
  position directly under it in `text-[11px] text-gray-500` — the
  same two-tier label pattern `GuestsPage` uses for guest name +
  booking count.
- Cell content: time range in `text-[11px] tabular-nums`, centered;
  OFF/VACATION/SICK render as the existing pill shape
  (`text-xs px-1.5 py-0.5 rounded-full`) from the guest-status pattern,
  recolored per the shift-status scale.
- Total-hours column: right-aligned, `font-bold text-[#376E6F]
  tabular-nums` — the one teal number in each row, same treatment
  `GuestsPage` gives total revenue.
- Coverage strip: a 3px-tall bar per day column, width proportional to
  headcount-scheduled-that-day relative to the week's max, filled
  teal-tinted. Purely visual, no interaction — a glance target, not a
  control.
- Click target: the whole cell, not a nested button — opens
  `ShiftEditModal` in the existing `BottomSheet`.

## Layout — Employee portal (`staff.pogostim.kz`)

```
┌────────────────────────────┐
│  Rizat Kabdybek        ⎋   │  ← name + logout, quiet header
├────────────────────────────┤
│  NEXT SHIFT                │  ← eyebrow label, not a heading
│  Today, 08:00 – 20:00      │  ← large, tabular-nums, teal
│  Honor Bar Attendant       │
├────────────────────────────┤
│  This week      45.0 h     │  ← one stat tile, same shape as
│                             │    GuestsPage's 3-tile stat row
├────────────────────────────┤
│  Mon 17   Day off          │
│  Tue 18   08:00 – 20:00    │  ← plain list, same row rhythm as
│  Wed 19   08:00 – 20:00    │    ChessGrid/GuestsPage list rows
│  ...                       │
└────────────────────────────┘
```

- Single column, mobile-first (this surface has no desktop use case —
  don't build a desktop layout for it).
- Next Shift card: white `rounded-xl` card, slightly more padding
  than the rest of the page (`p-5` vs `p-3`) — the one place on this
  screen that's allowed to breathe, everything else stays as compact
  as the rest of the app.
- Week-hours stat: reuse the exact 3-tile stat pattern from
  `GuestsPage`'s `GuestStatsPanel`, but with a single tile (no need to
  invent a new stat-tile shape for one number).
- Shift list: plain rows, date left / time or status right, `border-b
  border-gray-100 last:border-0` — identical rhythm to the booking
  list rows already in the app, so it doesn't feel like a foreign
  screen.
- Login screen: centered card, login field + `PinInput` (large-target
  numeric input, not segmented boxes — see design-system audit), teal
  primary button. No logo treatment beyond the existing app icon —
  don't design a new mark for a subdomain of the same product.

## Motion

None beyond what already exists in the app (`BottomSheet`'s slide-up,
`Toast`'s fade/slide, the shared spinner). No page-load choreography —
this is a tool people open dozens of times a day; motion should be
invisible, not a moment.

## Accessibility notes

- Coverage strip and all shift-status colors need a non-color signal
  too: status pills already carry text (OFF/VACATION/SICK), and work
  cells carry the time text — color is reinforcement, never the only
  signal. Verify contrast of `contrastTextColor`-selected text against
  each status background at implementation time (the audit's scale
  was picked for AA contrast but should be checked once built).
- `PinInput` needs `inputmode="numeric"` and a visible focus ring
  (the existing `focus:ring-2 focus:ring-[#376E6F]` pattern from
  `Toggle`/inputs elsewhere) — no reliance on browser default styling.
