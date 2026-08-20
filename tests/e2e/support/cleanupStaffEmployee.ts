import type { Page } from '@playwright/test'

/**
 * Deletes staff_employees rows whose login starts with `loginPrefix`, using
 * the currently-authenticated owner session's own access token (read from
 * localStorage) via a direct REST call. Keeps e2e test data from
 * accumulating across runs — a leftover employee from one spec can make an
 * unrelated spec's "only one employee lacks access" assumption break.
 */
export async function cleanupStaffEmployeesByLoginPrefix(page: Page, loginPrefix: string) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

  await page.evaluate(
    async ({ prefix, supabaseUrl, anonKey }) => {
      const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
      if (!storageKey) return
      const session = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
      const accessToken = session.access_token
      if (!accessToken) return

      await fetch(`${supabaseUrl}/rest/v1/staff_employees?login=like.${prefix}*`, {
        method: 'DELETE',
        headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      })
    },
    { prefix: loginPrefix, supabaseUrl, anonKey }
  )
}
