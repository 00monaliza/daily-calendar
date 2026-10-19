// Single source of truth lives next to the Edge Functions so Deno can bundle
// it; the app re-exports it to share exactly the same overlap rules.
export * from '../../../supabase/functions/_shared/bookingAvailability.ts'
