# ADR-0002: New staff tables in the existing Supabase project, not a new project

**Status:** Accepted
**Date:** 2026-08-21
**Deciders:** Owner (pogostim.kz)
**Related:** [Staff Scheduling & Employee Portal design](../superpowers/specs/2026-08-21-staff-scheduling-design.md), [ADR-0001](0001-single-deploy-two-surfaces.md)

## Context

The staff-scheduling data (`staff_employees`, `staff_shifts`) is
functionally unrelated to the existing `properties`/`bookings`/
`guests`/`expenses` domain, but both are single-tenant, owned by the
same one Supabase Auth user (the app owner), and both currently ship
from the same repo (ADR-0001).

## Decision

Add `staff_employees` and `staff_shifts` as new tables in the
**existing** Supabase project, migration-numbered after
`005_booking_sources.sql`, protected by their own RLS policies
(`owner_id = auth.uid()` for the owner, a narrower read-only policy
for employees). No new Supabase project is created.

## Options Considered

### Option A: Same Supabase project, new tables + RLS (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — one more migration file, one more `.env` unaffected |
| Cost | $0 marginal — same project tier |
| Scalability | Fine at single-tenant scale |
| Team familiarity | High — follows `002_rls.sql` pattern exactly |

**Pros:** One connection string, one auth provider, one place to
manage backups/migrations. Employee auth (ADR-0003) piggybacks
directly on the existing `auth.users` table via Supabase Auth,
without any cross-project token bridging.
**Cons:** The owner's Supabase project now hosts two unrelated
domains; a runaway query or heavy usage from one could theoretically
affect the other's connection pool at large scale (not a concern at
current scale).

### Option B: Dedicated Supabase project for staff scheduling

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — second client, second `.env` pair, migrations to keep in sync manually |
| Cost | Free tier likely sufficient, but doubles the number of projects to monitor |
| Scalability | Full isolation |
| Team familiarity | Low relative to benefit at this scale |

**Pros:** Clean separation if this becomes a separately sold product;
zero risk of one domain's RLS policies or migrations accidentally
touching the other's tables.
**Cons:** Employee auth would need to either duplicate Supabase Auth
setup in a second project or bridge identities across projects —
meaningfully more complexity for no near-term benefit. Explicitly
declined by the owner ("тот же проект Supabase (рекомендую)").

## Trade-off Analysis

The only strong argument for Option B is future resale as a
multi-tenant SaaS product, which the owner has explicitly deferred.
Until that materializes, splitting projects only adds operational
surface (two dashboards, two sets of env vars, two migration
histories) with no corresponding benefit. RLS policies scoped to
`owner_id`/`auth_user_id` give adequate isolation between the two
domains within one project today.

## Consequences

- Easier: single migration history, single Supabase dashboard, no
  cross-project identity bridging for employee auth.
- Harder: if the staff product is later split out (e.g. sold to other
  hotels), the tables and RLS policies will need to be extracted into
  their own project — the `staff_*` table prefix is chosen specifically
  to make that extraction mechanical (grep-able boundary).
- Revisit: alongside ADR-0001, if/when multi-tenancy is required.

## Action Items

1. [ ] Add migration `006_staff_scheduling.sql` creating
       `staff_employees`, `staff_shifts`, and their RLS policies.
2. [ ] Confirm the `staff_` prefix convention in any new
       entity/table naming during implementation.
