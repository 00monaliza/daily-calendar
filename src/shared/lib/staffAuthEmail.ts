const STAFF_EMAIL_DOMAIN = 'staff.pogostim.kz.internal'

/**
 * Normalizes a raw employee-entered login (phone number or username) to
 * lowercase alphanumeric-only. Both phone numbers and usernames go
 * through the same rule so the mapping to a synthetic email is
 * deterministic without needing to classify which kind of login it is.
 */
export function normalizeStaffLogin(rawLogin: string): string {
  const normalized = rawLogin.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  if (normalized.length === 0) {
    throw new Error('Login must contain at least one letter or digit')
  }
  return normalized
}

/**
 * Builds the non-deliverable synthetic email used as the Supabase Auth
 * identifier for an employee (see ADR-0003). Must produce the same
 * result everywhere it's called — client login form, employee
 * provisioning — so it lives in one place.
 */
export function buildStaffSyntheticEmail(rawLogin: string): string {
  return `${normalizeStaffLogin(rawLogin)}@${STAFF_EMAIL_DOMAIN}`
}
