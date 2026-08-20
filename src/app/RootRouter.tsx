import { useState } from 'react'
import { AppRouter } from './router/AppRouter'
import { StaffAppRouter } from './staff/StaffAppRouter'
import { isStaffHost } from '@/shared/lib/hostSurface'

function computeIsStaffHost(): boolean {
  const forceStaffApp =
    import.meta.env.VITE_FORCE_STAFF_APP === 'true' ||
    new URLSearchParams(window.location.search).get('staff') === '1'
  return isStaffHost(window.location.hostname, forceStaffApp)
}

/**
 * Decides once, at initial mount, which surface to show (see ADR-0001).
 * The decision is captured via a lazy useState initializer — NOT computed
 * inline in the render body — because BrowserRouter re-renders its whole
 * subtree on every client-side navigation, and `navigate('/schedule')`
 * drops the `?staff=1` dev-override query param from the URL. Reading
 * window.location directly in the render body would silently re-evaluate
 * to false after that first navigation and swap an authenticated employee
 * over to the owner app surface (verified this happen in manual testing
 * before landing this fix) — exactly the surface bleed-through ADR-0001
 * exists to prevent. useState's initializer runs exactly once per mount,
 * so the surface stays locked in for the lifetime of the page load
 * regardless of what the URL looks like afterward.
 */
export function RootRouter() {
  const [isStaff] = useState(computeIsStaffHost)

  return isStaff ? <StaffAppRouter /> : <AppRouter />
}
