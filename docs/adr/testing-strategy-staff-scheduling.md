# Testing Strategy — Staff Scheduling Feature

Date: 2026-08-21
Scope: [staff scheduling spec](../superpowers/specs/2026-08-21-staff-scheduling-design.md)

## Current state (baseline)

- Test tooling: Playwright only (`test:e2e`, `test:e2e:ui`), configured
  to hit a real running dev server (`baseURL: localhost:5173`) and, per
  the config's own comment, a real/staging Supabase project via
  `TEST_EMAIL`/`TEST_PASSWORD` in `.env.local` — not a mocked backend.
- No unit test runner configured (no Vitest/Jest).
- `tests/e2e/` doesn't contain any spec files yet — the harness exists,
  nothing has been written against it. This feature is effectively
  greenfield for tests, not "add to an existing pyramid."
- No CI workflow runs tests today (`.github/workflows/` only has an
  unrelated SLSA provenance publisher) — tests are run manually.
- No local Supabase stack (`supabase/config.toml` absent) — the CLI is
  installed but the project isn't wired for `supabase start`/pgTAP.

Given that baseline, the right strategy is the smallest addition that
covers the feature's actual risk, not a textbook pyramid retrofit.

## Should we introduce a unit test runner?

**Yes, add Vitest — but scoped narrowly.** Reasoning:

- Vite + Vitest is near-zero setup (shares `vite.config.ts`, one dev
  dependency) — this isn't "introducing a new test framework," it's
  turning on the test runner that already ships next to the bundler
  this project uses.
- The feature has two genuinely pure functions with real edge cases:
  **overnight-shift hour calculation** (21:00→09:00 must resolve to
  12.0h, not a negative number) and the **synthetic-email builder**
  used both client-side (login) and in the Edge Function (provisioning)
  — a normalization mismatch between the two silently breaks login.
  These are exactly what unit tests are for: many input/output pairs,
  zero I/O, sub-millisecond to run.
- The alternative — verifying every hour-calc edge case by clicking
  through the manager grid in Playwright — is slow, flaky (real
  Supabase round-trips per case), and makes the edge cases expensive
  enough that they won't actually get enumerated.

**Where this stops being worth it:** don't retrofit Vitest onto the
rest of the app's existing untested logic (e.g. `ChessGrid`'s
`getVisibleSpanDays`, `propertyColors.ts`) as part of this feature —
that's scope creep. Add Vitest for the two new pure functions this
feature introduces; expanding coverage elsewhere is a separate,
optional follow-up if the owner wants it later.

## Test plan by risk area

| Area | Risk if wrong | Layer | Why |
|------|---------------|-------|-----|
| Overnight hour calculation | Wrong totals on payroll-adjacent numbers the owner will actually read (e.g. "9.0" vs a negative or huge number) | **Unit (Vitest)** | Pure function, many edge cases, no I/O needed |
| Synthetic email construction | Employee can't log in, or two logins collide | **Unit (Vitest)** | Pure function; must be tested once and shared (imported) by both the client login form and the Edge Function, not reimplemented in both places |
| RLS: owner full CRUD on staff_employees/staff_shifts | Owner can't manage their own data (functional bug, not a security bug) | **App-level integration (Playwright, real Supabase)** | Exercised naturally by the manager-tab e2e flow below — no separate test needed |
| RLS: employee reads only their own shifts, zero cross-employee leakage | **Security bug** — one employee could read another's schedule | **Direct Supabase client script, two real auth sessions** (see below) — *not* Playwright-through-UI, and not pgTAP | Fastest way to assert the actual policy behavior the app depends on, without standing up a local Postgres/Docker stack this project doesn't have yet |
| RLS: employee has zero write access to staff_shifts | Employee could tamper with their own or others' schedule | Same as above | Same reasoning |
| Hostname routing: staff.pogostim.kz never renders owner-only routes/components | **Security/privacy bug** — an employee session could reach properties/bookings/finances code paths | **Playwright, two projects/configs** (see below) | This is fundamentally a rendered-DOM assertion — Playwright is the right tool, not a unit test |
| Click-cell → modal → upsert flow | Manager can't actually build a schedule (the feature's core value) | **Playwright e2e** | Real user flow, worth the weight of a full e2e test |
| PIN login flow (login+PIN → session → sees own schedule) | Employee can't get in, or gets in but sees wrong/no data | **Playwright e2e** | Real user flow spanning the synthetic-email unit under real network conditions |

### RLS leakage tests — recommended shape

Since there's no local Supabase/pgTAP harness in this project yet, and
introducing Docker-based local Postgres is a meaningfully bigger lift
than this single-developer project's current tooling (no CI even runs
tests today), don't add pgTAP for this feature. Instead, write a small
Node script (`tests/rls/staff-scheduling.rls.ts`, run via
`tsx`/`vitest run` against the **real dev/staging Supabase project**,
same pattern the existing Playwright config already uses via
`TEST_EMAIL`/`TEST_PASSWORD`):

1. Seed two test employees (`test-emp-a`, `test-emp-b`) with known
   PINs, owned by the test owner account.
2. Sign in as `test-emp-a` via `signInWithPassword` (anon key client).
3. Assert: `select * from staff_shifts` returns only rows where
   `auth_user_id = test-emp-a`'s uid — never `test-emp-b`'s rows.
4. Assert: any `insert`/`update`/`delete` against `staff_shifts` as
   `test-emp-a` is rejected by RLS.
5. Sign in as the owner; assert full read/write access to both
   employees' rows.
6. Teardown: delete the two test employees/shifts.

This is a real integration test (hits the live Supabase project, not
mocks), and directly proves the policy the app depends on — it just
skips the Docker/pgTAP ceremony this project doesn't have infrastructure
for yet. **Revisit pgTAP if/when a local Supabase dev stack gets
introduced for other reasons** — at that point migrating this script's
assertions into pgTAP is a natural upgrade, not urgent now.

### Hostname-routing test — recommended shape

Playwright already supports multiple `baseURL`s via projects. Add a
second Playwright project (`staff-portal`) pointed at
`http://staff.localhost:5173` (or use the `VITE_FORCE_STAFF_APP` dev
override from ADR-0001 with a query param instead of relying on local
DNS, whichever proves less fiddly in dev — decide during
implementation). The test:

1. Loads the employee-portal entry with a logged-in employee session.
2. Asserts specific owner-only UI never renders: no bottom-nav item
   for Properties/Finances/Guests, no route reachable by directly
   navigating to `/properties`, `/finances`, `/guests`, `/settings`
   from that hostname (expect a redirect or 404-equivalent, not the
   owner page).
3. Conversely, loads the owner app and asserts navigating to
   `/staff` from a *non-owner* (or logged-out) session does not leak
   the schedule grid.

## Coverage targets

Not aiming for a percentage target (no existing baseline to compare
against, and this is a single-developer app, not a team norm to
enforce). Concretely: every risk row in the table above needs at least
one test before Milestone 2 (employee portal) ships. Milestone 1
(manager tab only, spec's own phasing) can ship with the unit tests +
owner-side Playwright flow + RLS owner-access assertions; the
employee-read RLS test and hostname-routing test become required
before Milestone 2 goes live, since that's when an actual employee
session first exists in production.

## Explicitly skipped

- Visual regression testing — not used elsewhere in this app, not
  worth introducing for two new screens.
- Load/performance testing — single-tenant, small employee count,
  not a relevant risk at this scale.
- pgTAP / local Supabase Docker stack — deferred, see above.
