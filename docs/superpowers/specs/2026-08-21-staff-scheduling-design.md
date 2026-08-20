# Staff Scheduling & Employee Portal — Design

Date: 2026-08-21
Status: Approved for planning

## Purpose

The owner needs a Clockster-style tool to build weekly staff schedules
(who works when, colored shift blocks, OFF/VACATION days) and see
scheduled hours per employee. Employees need a lightweight way to view
their own schedule without touching the owner's booking/finance data.

This is a separate product bolted onto the existing pogostim.kz app:
same Supabase project and same Vercel deployment for simplicity, but
functionally independent of the properties/bookings/guests domain.

## Scope decisions (confirmed with owner)

- Single tenant: one company (the owner's own business), no
  `organization_id` needed anywhere.
- No real clock-in/clock-out tracking. "Attendance" (actual times,
  overtime, late-arrival stats) is explicitly out of scope for this
  build. Only the *scheduled* plan is tracked.
- Employee `position` is a free-text field on the employee record — no
  separate positions/departments catalog.
- "Groups & Events" / "Trainings & Meetings" freeform rows from the
  reference screenshot are deferred — not tied to hours reporting, can
  be added later as its own small project.
- Employee login: phone/username + PIN, no email requirement (many
  staff — servers, honor bar attendants — won't have an email they
  check).
- Manager builds the schedule by clicking a cell to open a modal
  (start/end time, or OFF/VACATION/SICK), not drag-and-drop. Simpler
  and works on mobile; can be upgraded later using the `@dnd-kit`
  patterns already used in the chess-grid widget.

## Architecture: two surfaces, one codebase, one deploy

- **Manager surface**: a new `/staff` tab inside the existing owner
  app (pogostim.kz), behind the current `ProtectedRoute` / owner
  Supabase Auth session. This is where the schedule grid and employee
  list live.
- **Employee surface**: `staff.pogostim.kz`, added as an extra domain
  on the *same* Vercel project (no second deployment, no second
  Supabase project). At runtime the app checks
  `window.location.hostname`: `staff.pogostim.kz` renders a small
  employee router (PIN login → Schedules); every other hostname
  renders the existing owner app plus the new `/staff` tab. Both
  routers are lazy-loaded (`React.lazy`, matching the existing
  `AppRouter` pattern) so neither bundle drags in the other's code.
- Local dev: a `VITE_FORCE_STAFF_APP` env flag (or a `?staff=1` query
  param) forces the employee router locally without needing a real
  `staff.` hostname.

**Manual infra step (owner-performed, not code):** add
`staff.pogostim.kz` as a domain on the Vercel project, then add the
CNAME record Vercel provides at the DNS host for pogostim.kz. Exact
values to be handed over at implementation time.

## Data model

New tables, migration-numbered after the existing `005_booking_sources.sql`.

### `staff_employees`

| column        | type      | notes                                      |
|---------------|-----------|---------------------------------------------|
| id            | uuid pk   | default gen_random_uuid()                  |
| owner_id      | uuid      | references auth.users(id), the app owner   |
| full_name     | text      |                                             |
| position      | text      | free text, nullable                        |
| login         | text      | unique (normalized: lowercase, digits-only for phone-style logins) |
| auth_user_id  | uuid      | nullable until PIN/account is provisioned; references auth.users(id) |
| is_active     | boolean   | default true                               |
| sort_order    | int       | nullable, for manual ordering in the grid  |
| created_at    | timestamptz | default now()                            |

### `staff_shifts`

| column       | type      | notes                                                     |
|--------------|-----------|------------------------------------------------------------|
| id           | uuid pk   | default gen_random_uuid()                                 |
| owner_id     | uuid      | references auth.users(id); denormalized for simple RLS    |
| employee_id  | uuid      | references staff_employees(id) on delete cascade           |
| auth_user_id | uuid      | denormalized copy of staff_employees.auth_user_id, kept in sync on write, used for the employee-read RLS policy without a subquery |
| date         | date      |                                                             |
| start_time   | time      | nullable (null when status != 'work')                     |
| end_time     | time      | nullable; may be earlier than start_time to represent an overnight shift (e.g. 21:00 → 09:00), interpreted as crossing midnight |
| status       | text      | enum-like: 'work' \| 'day_off' \| 'vacation' \| 'sick'     |
| note         | text      | nullable, e.g. "Shift Lead"                                |
| created_at   | timestamptz | default now()                                            |
| updated_at   | timestamptz | default now()                                            |

Unique constraint on `(employee_id, date)` — one entry per employee
per day, matching the reference schedule (no split shifts in v1).

Total/weekly hours are computed client-side from `staff_shifts` rows
in the visible date range — no separate aggregation table needed at
this scale.

### RLS

Same pattern as `002_rls.sql`:

```sql
alter table staff_employees enable row level security;
alter table staff_shifts enable row level security;

create policy "owner_full_access" on staff_employees
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "employee_reads_own_record" on staff_employees
  for select using (auth.uid() = auth_user_id);

create policy "owner_full_access" on staff_shifts
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "employee_reads_own_shifts" on staff_shifts
  for select using (auth.uid() = auth_user_id);
```

Employees never get insert/update/delete policies on `staff_shifts` —
the schedule is read-only for them in this build.

## Employee authentication (PIN-based)

No email required. Each employee gets a real Supabase Auth user under
a synthetic, non-deliverable email:

```
<normalized-login>@staff.pogostim.kz.internal
```

with the **PIN used as the Supabase Auth password**. This reuses
Supabase Auth end-to-end (standard session/refresh tokens, RLS via
`auth.uid()`) instead of hand-rolling JWT issuance.

- **Employee login (client-side, anon key)**: deterministically build
  the synthetic email from the entered login, then call
  `supabase.auth.signInWithPassword({ email, password: pin })`. No
  lookup call needed first.
- **Employee creation / PIN reset (manager-side)**: requires
  `auth.admin.createUser` / `auth.admin.updateUserById`, which need
  the service-role key. This runs in a Supabase Edge Function
  (`staff-provision-employee`), called from the manager UI, never
  exposing the service-role key to the browser. The function also
  creates/updates the `staff_employees` row (`auth_user_id`, `login`)
  in the same call.
- `login` uniqueness is enforced at the DB level so synthetic emails
  can never collide.

**Known tradeoff, accepted for v1:** a 4–6 digit PIN is weaker than a
real password. Mitigated by: single-tenant (low-value target),
employees have read-only access to their own schedule only, and
Supabase Auth's default per-IP rate limiting on sign-in attempts. If
this becomes a concern later, add a Postgres-level lockout after N
failed attempts.

## Manager UI (`/staff` tab, owner app)

- **Employees list**: name, position, login, active toggle,
  drag-reorder (reuse the pattern from properties' `sort_order`).
  "Add employee" modal collects name/position/login + sets an initial
  PIN, submitting to the `staff-provision-employee` Edge Function.
- **Weekly schedule grid**: week navigator (prev/next week). Rows =
  employees (ordered by `sort_order`), columns = the 7 days of the
  selected week plus a computed "Total hrs" column. Cells render the
  shift time or an OFF/VACATION/SICK badge, colored by status.
  Clicking a cell opens a modal to set start/end time or mark the day
  off/vacation/sick; saving upserts into `staff_shifts` (unique on
  `employee_id`+`date` makes this a safe upsert).
- New FSD slices: `src/entities/staff-employee`, `src/entities/staff-shift`,
  `src/widgets/staff-schedule-grid`, `src/pages/staff/StaffSchedulePage.tsx`,
  wired into the existing `AppRouter` under `ProtectedRoute`.

## Employee UI (`staff.pogostim.kz`)

- **Login page**: login + PIN input (numeric-friendly).
- **Schedules** (the only tab in this build — Attendance is
  deliberately excluded): a list/calendar of the employee's own
  shifts (past and upcoming), each showing date, status, and
  start/end time when working. A simple "scheduled hours this
  week / this month" total, computed the same way as the manager
  grid. Entirely read-only.
- New top-level app: `src/app/staff/StaffAppRouter.tsx` (separate
  small router: `/login`, `/schedule`), its own minimal layout — no
  bottom-nav, no properties/finances/guests code paths reachable from
  this surface.

## Testing

Extend the existing Playwright suite (`test:e2e`):

1. Manager creates an employee and a shift via the `/staff` tab.
2. Employee logs into the staff app with login + PIN and sees that
   shift under Schedules.
3. RLS check: employee A cannot read employee B's shifts; employee
   role cannot write to `staff_shifts` (direct Supabase call in test,
   expecting a policy rejection).

## Delivery milestones

1. **Milestone 1 — data model + manager tab.** Migrations, RLS,
   `staff_employees`/`staff_shifts` entities, the `/staff` tab
   (employee list + weekly grid + hours). Useful to the owner on its
   own, before any employee ever logs in.
2. **Milestone 2 — employee portal.** `staff-provision-employee` Edge
   Function, PIN login, `staff.pogostim.kz` domain wiring, the
   employee Schedules view, hostname-based routing in the app entry
   point.

## Explicitly out of scope (this build)

- Real clock-in/clock-out, actual-vs-scheduled variance, overtime,
  late-arrival tracking ("Attendance" tab).
- Multi-tenant / multiple companies.
- Configurable positions/departments catalog.
- Groups & Events / Trainings & Meetings freeform schedule rows.
- Drag-and-drop shift assignment.
