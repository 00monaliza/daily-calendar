import { AppRouter } from './router/AppRouter'
import { StaffAppRouter } from './staff/StaffAppRouter'
import { isStaffHost } from '@/shared/lib/hostSurface'

/**
 * Decides once, at initial render, which surface to show (see ADR-0001).
 * Deliberately does NOT re-evaluate on every client-side navigation — the
 * chosen surface is sticky for the lifetime of the page load, which is
 * exactly right: an owner session and an employee session never need to
 * swap mid-session. The `?staff=1` query param exists only so the staff
 * portal can be exercised in dev/tests without real DNS for
 * staff.pogostim.kz.
 */
export function RootRouter() {
  const forceStaffApp =
    import.meta.env.VITE_FORCE_STAFF_APP === 'true' ||
    new URLSearchParams(window.location.search).get('staff') === '1'

  return isStaffHost(window.location.hostname, forceStaffApp) ? <StaffAppRouter /> : <AppRouter />
}
