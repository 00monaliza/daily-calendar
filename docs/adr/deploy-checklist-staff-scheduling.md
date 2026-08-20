# Deploy Checklist — Staff Scheduling Feature

Scope: [staff scheduling spec](../superpowers/specs/2026-08-21-staff-scheduling-design.md)
Deploy shape: single Vercel project (git push → Vercel build, with
automatic preview deployments per branch/PR serving as the de facto
staging step — this project has no separate staging environment or
CI test gate today).

Items marked **[OWNER]** require the account owner's own credentials
(Vercel dashboard, DNS registrar, Supabase service-role key/secrets) —
these are actions I can't perform on your behalf; I'll hand you exact
values/commands when we get there.

---

## Milestone 1 — Manager `/staff` tab (no new domain, no Edge Function)

### Pre-deploy
- [ ] Migration `006_staff_scheduling.sql` (staff_employees,
      staff_shifts, RLS policies) reviewed — since RLS is the only
      thing standing between the owner's data and any other
      authenticated Supabase user, re-read the policies once more
      right before applying.
- [ ] Unit tests (Vitest: overnight-hour calc, synthetic-email
      builder) passing locally.
- [ ] Owner-side Playwright flow (create employee → build a week's
      schedule → see correct total hours) passing locally against a
      real Supabase project.
- [ ] `npm run build` succeeds locally (this app has bitten itself on
      production-only build failures before — see the "Fix production
      build failure in guest pie chart tooltip" commit — so don't
      skip this even though it feels redundant with dev).
- [ ] No secrets (service-role key, PINs, etc.) present in any client
      bundle or committed file — Milestone 1 doesn't need the
      service-role key at all, so this is mostly a "didn't
      accidentally add it" check.
- [ ] Rollback plan: this milestone only adds new tables and a new
      route (`/staff`) — nothing existing is modified, so rollback is
      "revert the PR" with no data-loss risk to the existing
      properties/bookings/guests/finances tables.

### Deploy
- [ ] **[OWNER]** Apply migration `006_staff_scheduling.sql` to the
      production Supabase project (via `supabase db push` or the SQL
      editor — whichever this project already uses for
      001–005; I don't have production DB credentials, so this step
      is run by you or with your explicit go-ahead if I'm given
      temporary access).
- [ ] Push branch → verify the Vercel preview deployment: log in as
      owner, open `/staff`, create a test employee, build a week's
      schedule, confirm hours total correctly (including one
      overnight shift).
- [ ] Merge to main → Vercel deploys to production automatically.
- [ ] Smoke test on the live `pogostim.kz/staff`: same flow as the
      preview check above, once, against production data.

### Post-deploy
- [ ] Confirm the existing app surfaces (chess grid, properties,
      finances, guests) still work — this milestone touches shared
      router/layout code, so a quick pass through the bottom-nav is
      worth the two minutes.
- [ ] Delete the test employee created during the preview/smoke checks.

### Rollback triggers
- `/staff` throws on load, or the rest of the app (chess grid,
  properties, etc.) breaks after this deploy → revert the Vercel
  deployment (redeploy the previous commit) immediately; the new
  tables can stay in place (they're additive and unused by the rest
  of the app) while the code is rolled back.

---

## Milestone 2 — Employee portal (`staff.pogostim.kz`)

This milestone adds a second entry point with real credentials
(employee PINs) and a service-role-key Edge Function, so it carries
more weight than Milestone 1.

### Pre-deploy
- [ ] RLS leakage test (`tests/rls/staff-scheduling.rls.ts` per the
      testing strategy doc) passing against a real Supabase project —
      **do not ship this milestone without this test passing**; it's
      the one that proves employee A can't read employee B's shifts.
- [ ] Hostname-routing Playwright test passing — proves
      `staff.pogostim.kz` never renders owner-only routes.
- [ ] PIN-login e2e flow passing.
- [ ] **[OWNER]** `staff-provision-employee` Edge Function deployed
      to Supabase (`supabase functions deploy staff-provision-employee`)
      with the service-role key set as a Supabase secret
      (`supabase secrets set ...`), **never** in `.env`/client code
      and never committed to the repo. I don't have your Supabase
      service-role key or dashboard access, so this deploy step and
      the secret configuration are yours to run — I'll hand you the
      exact function code and command.
- [ ] Confirm `.env.local`/Vercel project env vars for the *client*
      only ever contain the anon key, never the service-role key.
- [ ] Rollback plan: reverting the app code is safe (employee portal
      simply stops being served); reverting the Edge Function means
      no new employees/PIN resets can be provisioned until it's
      redeployed, but existing sessions/data are unaffected.

### Deploy
- [ ] **[OWNER]** Add `staff.pogostim.kz` as a domain on the existing
      Vercel project (Vercel dashboard → Project → Settings →
      Domains). I don't have dashboard access — this is your click.
- [ ] **[OWNER]** Add the DNS record Vercel gives you (typically a
      CNAME) at pogostim.kz's DNS host. I don't have registrar access
      — this is your DNS panel action. DNS propagation can take
      anywhere from minutes to a few hours; don't schedule the rest
      of this rollout tightly against it.
- [ ] Verify `staff.pogostim.kz` resolves and serves the app (SSL
      cert auto-provisioned by Vercel once DNS is verified — confirm
      the padlock, not just that the page loads).
- [ ] Provision one real test employee end-to-end: manager creates
      them in `/staff`, employee logs into `staff.pogostim.kz` with
      login+PIN, confirms they see their own (and only their own)
      schedule.
- [ ] Merge to main → production deploy (same build serves both
      hostnames, per ADR-0001 — no separate deploy step for the
      employee portal beyond the domain/DNS work above).

### Post-deploy
- [ ] Confirm the owner app on `pogostim.kz` is unaffected (same
      hostname-branch risk as Milestone 1, now with a second real
      hostname live).
- [ ] Roll out real employee logins gradually if the staff list is
      large — set PINs and hand them out in person/verbally, not over
      an insecure channel, since a PIN is the employee's entire
      credential (per ADR-0003).
- [ ] Delete the test employee created during rollout, or convert it
      to a real one.

### Rollback triggers
- Any RLS leakage discovered post-launch (an employee report of
  seeing wrong data, or a failed spot-check) → treat as a security
  incident: revoke the Edge Function's ability to provision new
  employees immediately (rotate/disable the service-role key access
  if needed) and roll back the app deploy; do not wait for a
  scheduled fix.
- Hostname-routing bleed-through (employee portal shows owner data,
  or vice versa) → immediate rollback, same severity as above.
- DNS/SSL misconfiguration making `staff.pogostim.kz` unreachable →
  not a rollback scenario (no user-facing regression on the existing
  `pogostim.kz`), just a fix-forward on the domain config.
