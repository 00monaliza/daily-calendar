# ADR-0003: Employee PIN login via synthetic email + Supabase Auth password

**Status:** Accepted
**Date:** 2026-08-21
**Deciders:** Owner (pogostim.kz)
**Related:** [Staff Scheduling & Employee Portal design](../superpowers/specs/2026-08-21-staff-scheduling-design.md)

## Context

Employees (servers, honor bar attendants, etc.) need to log into
`staff.pogostim.kz` to view their own schedule. Many won't reliably
check an email inbox, and the owner explicitly wants login by
phone/username + a short PIN, not email + password. Whatever is
built has to reuse Supabase Auth's session handling (so RLS keeps
working via `auth.uid()`) — there's no appetite for hand-rolled
session/token infrastructure for a single-tenant internal tool.

## Decision

Give each employee a **real Supabase Auth user** under a
non-deliverable synthetic email:

```
<normalized-login>@staff.pogostim.kz.internal
```

with the employee's **PIN stored as the Supabase Auth password**.

- Login (client, anon key): deterministically build the synthetic
  email from the entered login, then call
  `supabase.auth.signInWithPassword({ email, password: pin })`. No
  network lookup needed before the sign-in call.
- Provisioning/reset (manager-only): a Supabase Edge Function
  (`staff-provision-employee`) uses the service-role key to call
  `auth.admin.createUser` / `auth.admin.updateUserById`, then
  writes/updates the corresponding `staff_employees` row in the same
  call. The service-role key never reaches the browser.
- `login` is unique at the DB level so synthetic emails can't collide.

## Options Considered

### Option A: Synthetic email + Supabase Auth password (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — no custom JWT signing, no session refresh logic to hand-build |
| Cost | $0 marginal, one small Edge Function |
| Security | PIN-strength password, mitigated by scope (see Trade-offs) |
| Team familiarity | High — `supabase-js` auth calls already used throughout the app |

**Pros:** Standard Supabase session (access + refresh token), works
with RLS (`auth.uid()`) with zero custom middleware, reuses the
existing `supabase` client already in `shared/api/supabaseClient.ts`.
**Cons:** A 4–6 digit PIN is a much smaller keyspace than a real
password; Supabase Auth's own password strength messaging doesn't
apply cleanly to PINs.

### Option B: Custom JWT minted by an Edge Function

| Dimension | Assessment |
|-----------|------------|
| Complexity | High — must sign, verify, and refresh custom JWTs; RLS policies need `auth.jwt()` claim wiring instead of `auth.uid()` |
| Cost | $0, but ongoing maintenance of token lifecycle code |
| Security | Same PIN-strength floor as Option A, more code to get wrong |
| Team familiarity | Low — nothing like this exists in the codebase today |

**Pros:** Full control over claims/expiry.
**Cons:** Reimplements what Supabase Auth already does, for no
functional gain here — strictly more surface area to secure and test.

### Option C: Real email/SMS OTP per employee

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — needs an SMS provider integration for phone OTP, or requires every employee to have/check email |
| Cost | Ongoing per-SMS cost if phone OTP is used |
| Security | Stronger than a PIN |
| Team familiarity | Low — no SMS provider currently integrated |

**Pros:** Better security posture, no shared-secret PIN to leak.
**Cons:** Directly conflicts with the stated constraint — staff don't
reliably have checked email, and SMS OTP adds a paid third-party
dependency and setup work disproportionate to a read-only schedule
view.

## Trade-off Analysis

The employee surface is strictly read-only (viewing one's own
schedule) in a single-tenant deployment — there is no financial or
destructive action a compromised employee session could take. Given
that, Option A's weaker credential strength is an acceptable,
explicitly-flagged trade-off in exchange for reusing Supabase Auth
wholesale instead of building and maintaining custom token
infrastructure (Option B) or adding a paid SMS dependency
disproportionate to the risk (Option C).

**Mitigations accepted for v1:**
- Supabase Auth's default per-IP rate limiting on `signInWithPassword`.
- Encourage 6-digit PINs over 4-digit at employee-creation time in the
  manager UI (soft guidance, not enforced as a hard minimum per the
  owner's call).
- No write access for the employee role at all — a successful login
  only exposes that employee's own read-only schedule data.

## Consequences

- Easier: employee login is a two-line client call; no custom auth
  middleware, refresh-token handling, or claim-verification code to
  write or maintain.
- Harder: if requirements later call for stronger employee auth
  (e.g. selling this to other businesses, or giving employees
  write access), this ADR should be revisited — at that point Option
  C (or a hardened Option A with enforced PIN length + lockout)
  becomes worth the added cost.
- Revisit trigger: any future feature that gives the employee role
  write access, or multi-tenant/resale plans (see ADR-0001, ADR-0002).

## Action Items

1. [ ] Implement the synthetic-email builder as a small pure function,
       shared between the Edge Function and the client login form, so
       normalization can never drift between the two.
2. [ ] Build the `staff-provision-employee` Edge Function
       (create/reset), authenticated to only the owner's session.
3. [ ] Add a Postgres-level uniqueness constraint on
       `staff_employees.login` (normalized).
4. [ ] Default the manager UI's PIN input to 6 digits, with a note on
       why (without hard-blocking shorter PINs, per the owner's call).
