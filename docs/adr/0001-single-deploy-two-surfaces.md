# ADR-0001: Single codebase, single deploy, two hostname-routed surfaces

**Status:** Accepted
**Date:** 2026-08-21
**Deciders:** Owner (pogostim.kz)
**Related:** [Staff Scheduling & Employee Portal design](../superpowers/specs/2026-08-21-staff-scheduling-design.md)

## Context

We're adding a staff-scheduling product on top of the existing
pogostim.kz app (Vite + React 19 + React Router 7 + Supabase,
FSD-layered). It needs two distinct front ends:

- A **manager surface** — a schedule-builder tab for the existing
  owner, who is already authenticated in the current app.
- An **employee surface** — a read-only "my schedule" view for staff,
  served on `staff.pogostim.kz`, with its own (PIN-based) login and no
  access to properties/bookings/finances/guests.

The product is conceptually separate from the property-rental domain
(confirmed with the owner: "отдельный продукт"), but is being built
inside the same repository for delivery speed, and the owner already
controls the `pogostim.kz` domain and its Vercel project.

Constraints: single developer/owner, no existing multi-app or
monorepo tooling in this project (no Nx/Turborepo), one Vercel
project currently deployed from this repo, one Supabase project.

## Decision

Serve both surfaces from the **same Vite build and the same Vercel
deployment**. At app start, branch on `window.location.hostname`:

- `staff.pogostim.kz` → a small, separate, lazy-loaded employee
  router (`/login`, `/schedule`), with its own minimal layout.
- Any other hostname → the existing owner `AppRouter`, extended with a
  new `/staff` tab (schedule builder, employee list).

`staff.pogostim.kz` is added as an additional domain on the existing
Vercel project (not a new project), with a CNAME added at the DNS
host. A `VITE_FORCE_STAFF_APP` env flag / `?staff=1` query param lets
the employee router be exercised in local dev without a real
`staff.` hostname.

## Options Considered

### Option A: Single codebase, single deploy, hostname branch (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — one router-level branch, both sub-routers already fit the existing `lazy()` + `Suspense` pattern in `AppRouter.tsx` |
| Cost | No additional hosting, no additional Supabase project |
| Scalability | Fine at this scale (single tenant, small employee count) |
| Team familiarity | High — reuses exactly the patterns already in the repo |

**Pros:**
- Zero new infra to provision or pay for beyond one DNS record.
- Shared Supabase client, shared design tokens/UI primitives, shared
  i18n setup — the employee portal doesn't need to reinvent any of
  that.
- One `vercel.json`, one build pipeline, one place to deploy.

**Cons:**
- A hostname-detection bug could theoretically leak the wrong router
  to the wrong domain (mitigated: the branch is a single, well-tested
  top-level check, and the employee router has zero routes that touch
  owner-only entities).
- The two surfaces share a JS bundle boundary conceptually, even
  though `React.lazy` keeps the *shipped* code separate per hostname.

### Option B: Separate app package in the same repo (e.g. Vite workspace / monorepo)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — needs a workspace tool (pnpm workspaces, Turborepo, etc.) not currently in this project |
| Cost | Likely a second Vercel project (still free-tier feasible) |
| Scalability | Better long-term isolation if the employee portal grows large |
| Team familiarity | Low — no existing monorepo tooling to build on |

**Pros:** Full build isolation; a bug in the owner app's build can't
break the employee app's build and vice versa.
**Cons:** New tooling to introduce and maintain for a single-developer
project with a comparatively small employee-facing surface. Slower to
ship the first milestone.

### Option C: Fully separate repository and Supabase project

| Dimension | Assessment |
|-----------|------------|
| Complexity | High — duplicate auth setup, duplicate CI, duplicate env management |
| Cost | Second Supabase project (still free-tier feasible, but more moving parts) |
| Scalability | Best isolation, matches a future "sell this as SaaS" path |
| Team familiarity | Low relative to effort — most of the setup is boilerplate this repo already has |

**Pros:** Maximum isolation; natural fit if this ever becomes a
separately-sold product for other hotels.
**Cons:** Explicitly rejected by the owner for this build ("тот же
проект Supabase") — the SaaS/multi-tenant path is out of scope until
there's demand for it.

## Trade-off Analysis

The owner explicitly ruled out multi-tenancy and a separate Supabase
project for this build, which removes most of the justification for
Options B/C. Option A's main risk — surface bleed-through via a
hostname-detection bug — is cheap to close with a single well-placed
router branch and a Playwright test that asserts the employee router
never renders owner-only routes. Given a single owner-developer and a
small employee count, the isolation benefits of B/C aren't worth the
tooling overhead they'd introduce today.

## Consequences

- Easier: shipping fast, reusing UI primitives/i18n/Supabase client,
  zero new hosting bills.
- Harder: if the employee portal later needs its own release cadence
  or a fully separate team, migrating to Option B/C means extracting
  code that's currently colocated — but the FSD layering (new slices
  under `entities/staff-*`, `widgets/staff-*`, `app/staff/*`) is
  structured so that extraction is a copy/move, not a rewrite.
- Revisit: if the product is ever sold to other businesses
  (multi-tenant), this ADR should be revisited alongside the
  single-tenant assumption in ADR-0002.

## Action Items

1. [ ] Add `staff.pogostim.kz` as a domain on the existing Vercel project.
2. [ ] Add the CNAME record at the DNS host for pogostim.kz.
3. [ ] Implement the hostname branch at the app's router entry point.
4. [ ] Add `VITE_FORCE_STAFF_APP` (or equivalent) for local dev.
5. [ ] Add a Playwright test asserting the employee router never
       exposes owner-only routes/components.
