export const STAFF_HOSTNAME = 'staff.pogostim.kz'

/**
 * Decides which app surface to render (see ADR-0001). `forceStaffApp` lets
 * the employee router be exercised without real DNS: locally via
 * VITE_FORCE_STAFF_APP, or in tests via a `?staff=1` query param — both are
 * read once by the caller (RootRouter) and passed in here as a plain bool,
 * keeping this function pure and easy to test exhaustively.
 */
export function isStaffHost(hostname: string, forceStaffApp: boolean): boolean {
  if (forceStaffApp) return true
  return hostname === STAFF_HOSTNAME
}
