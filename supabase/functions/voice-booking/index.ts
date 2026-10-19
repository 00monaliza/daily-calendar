// Voice booking: takes a dictated phrase from the iOS Shortcut, extracts the
// booking fields with Claude, checks availability and stores a pending draft
// the user confirms in the app. It never creates a booking.
//
// Auth: header `x-voice-token: <personal token>` only (see Settings page).
// Signed-in app users can't call it, so nobody but the token's owner spends
// the Anthropic key, and each owner is capped at VOICE_BOOKING_DAILY_LIMIT
// calls per 24 hours. Deploy with --no-verify-jwt: the Shortcut has no
// Supabase JWT, so this function verifies the token itself.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import { addDaysIso, buildAvailabilityReport, isIsoDate } from '../_shared/bookingAvailability.ts'
import {
  BOOKING_OUTPUT_SCHEMA,
  buildSummary,
  buildSystemPrompt,
  buildUserPrompt,
  normalizeModelOutput,
  type ModelBookingOutput,
  type VoiceProperty,
} from '../_shared/voiceBooking.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-voice-token',
}

const DEFAULT_DAILY_LIMIT = 30

const DEFAULT_SOURCES = ['direct', 'kaspi', 'booking', 'airbnb', 'avito', 'cash', 'other']
const MAX_TRANSCRIPT_LENGTH = 2000

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function resolveOwnerId(req: Request, adminClient: SupabaseClient): Promise<string | null> {
  const voiceToken = req.headers.get('x-voice-token')?.trim()
  if (!voiceToken) return null
  const { data } = await adminClient
    .from('voice_tokens')
    .select('owner_id')
    .eq('token_hash', await sha256Hex(voiceToken))
    .maybeSingle()
  return data?.owner_id ?? null
}

function dailyLimit(): number {
  const value = Number(Deno.env.get('VOICE_BOOKING_DAILY_LIMIT'))
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_DAILY_LIMIT
}

// Every call that reaches Claude ends in a draft, so drafts from the last
// 24 hours are the call count.
async function overDailyLimit(adminClient: SupabaseClient, ownerId: string): Promise<boolean> {
  const { count, error } = await adminClient
    .from('voice_booking_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
  if (error) throw error
  return (count ?? 0) >= dailyLimit()
}

function todayIn(timeZone: string): { today: string; weekday: string } {
  const now = new Date()
  let zone = timeZone
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone })
  } catch {
    zone = 'Asia/Almaty'
  }
  return {
    today: new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now),
    weekday: new Intl.DateTimeFormat('ru-RU', { timeZone: zone, weekday: 'long' }).format(now),
  }
}

async function extractBooking(params: {
  transcript: string
  today: string
  weekday: string
  properties: VoiceProperty[]
  sources: string[]
}): Promise<ModelBookingOutput> {
  // Trimmed: a pasted secret often carries a trailing newline or space.
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')?.trim() })
  // Haiku by default: the user is waiting on the Shortcut and extraction is easy.
  const model = Deno.env.get('VOICE_BOOKING_MODEL') || 'claude-haiku-5-5'
  // Haiku has no server-side refusal fallback; larger models re-run a
  // classifier-declined request on Anthropic's recommended model.
  const fallback = model.startsWith('claude-haiku')
    ? {}
    : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
  const response = await client.beta.messages.create({
    model,
    max_tokens: 4000,
    ...fallback,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: BOOKING_OUTPUT_SCHEMA },
    },
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserPrompt(params) }],
  })

  if (response.stop_reason === 'refusal') throw new Error('Модель отказалась разбирать фразу')
  if (response.stop_reason === 'max_tokens') throw new Error('Ответ модели обрезан')
  const text = response.content.find(block => block.type === 'text')
  if (!text || text.type !== 'text') throw new Error('Пустой ответ модели')
  return JSON.parse(text.text) as ModelBookingOutput
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST only' }, 405)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const transcript = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TRANSCRIPT_LENGTH) : ''
    if (!transcript) {
      return jsonResponse({ error: 'Пустой текст', summary: 'Ничего не услышал — попробуйте ещё раз.' }, 400)
    }

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const ownerId = await resolveOwnerId(req, adminClient)
    if (!ownerId) {
      return jsonResponse({ error: 'Not authenticated', summary: 'Токен не подошёл. Создайте новый в Настройках.' }, 401)
    }
    if (await overDailyLimit(adminClient, ownerId)) {
      return jsonResponse({
        error: 'Daily limit reached',
        summary: `Лимит ${dailyLimit()} голосовых броней за сутки исчерпан. Добавьте бронь вручную в приложении.`,
      }, 429)
    }

    const [{ data: propertiesData, error: propertiesError }, { data: settings }] = await Promise.all([
      adminClient
        .from('properties')
        .select('id, name, base_price, voice_aliases, is_active')
        .eq('owner_id', ownerId)
        .order('sort_order', { nullsFirst: false }),
      adminClient.from('settings').select('timezone, booking_sources').eq('user_id', ownerId).maybeSingle(),
    ])
    if (propertiesError) throw propertiesError

    const properties: VoiceProperty[] = (propertiesData ?? [])
      .filter(p => p.is_active !== false)
      .map(p => ({ id: p.id, name: p.name, base_price: p.base_price ?? 0, voice_aliases: p.voice_aliases ?? [] }))
    const sources: string[] = settings?.booking_sources?.length ? settings.booking_sources : DEFAULT_SOURCES
    const { today, weekday } = todayIn(settings?.timezone ?? 'Asia/Almaty')

    const raw = await extractBooking({ transcript, today, weekday, properties, sources })
    const parsed = normalizeModelOutput(raw, { transcript, properties, sources, today })

    const hasDates = isIsoDate(parsed.check_in) && isIsoDate(parsed.check_out)
    const windowFrom = hasDates ? addDaysIso(parsed.check_in!, -30) : today
    const windowTo = hasDates ? addDaysIso(parsed.check_out!, 30) : addDaysIso(today, 60)

    const [{ data: bookingsData, error: bookingsError }, knownPhone] = await Promise.all([
      adminClient
        .from('bookings')
        .select('id, property_id, check_in, check_out, guest_name')
        .eq('owner_id', ownerId)
        .gte('check_out', windowFrom)
        .lte('check_in', windowTo),
      parsed.guest_name && !parsed.guest_phone
        ? adminClient
          .from('bookings')
          .select('guest_phone')
          .eq('owner_id', ownerId)
          .ilike('guest_name', parsed.guest_name.replace(/[%_]/g, ''))
          .not('guest_phone', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(r => r.data?.[0]?.guest_phone ?? null)
        : Promise.resolve(null),
    ])
    if (bookingsError) throw bookingsError
    parsed.known_guest_phone = knownPhone

    const availability = buildAvailabilityReport({
      bookings: bookingsData ?? [],
      properties,
      propertyId: parsed.property_id,
      checkIn: parsed.check_in,
      checkOut: parsed.check_out,
      today,
    })

    const { data: draft, error: draftError } = await adminClient
      .from('voice_booking_drafts')
      .insert({ owner_id: ownerId, transcript, parsed, availability })
      .select('id')
      .single()
    if (draftError) throw draftError

    const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
    const summary = buildSummary(parsed, availability, properties, transcript)

    // Only the summary and link: the full draft (with a phone looked up from
    // guest history) stays behind RLS for the signed-in app, so a leaked voice
    // token can't be used to look up guests' phones.
    return jsonResponse({
      draft_id: draft.id,
      open_url: appUrl ? `${appUrl}/?voice_draft=${draft.id}` : null,
      summary,
    })
  } catch (err) {
    console.error('voice-booking failed', err)
    if (err instanceof Anthropic.AuthenticationError) {
      return jsonResponse({
        error: 'Anthropic API key rejected',
        summary: 'Ключ Anthropic не подошёл. Проверьте секрет ANTHROPIC_API_KEY в Supabase → Edge Functions → Secrets.',
      }, 502)
    }
    if (err instanceof Anthropic.RateLimitError) {
      return jsonResponse({ error: 'Anthropic rate limit', summary: 'Сервис распознавания перегружен, попробуйте через минуту.' }, 503)
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return jsonResponse({ error: message, summary: `Не получилось разобрать бронь: ${message}` }, 500)
  }
})
