// Pure helpers for turning a dictated phrase into a booking draft. Shared by
// the voice-booking Edge Function and the web app; no imports except the
// sibling availability module so it runs unchanged in Deno and Vite.

import { addDaysIso, diffDaysIso, isIsoDate, type AvailabilityReport } from './bookingAvailability.ts'

export type PaymentStatus = 'waiting' | 'partial' | 'paid'

export interface VoiceProperty {
  id: string
  name: string
  base_price: number
  voice_aliases: string[] | null
}

export type VoiceField =
  | 'property_id'
  | 'guest_name'
  | 'guest_phone'
  | 'check_in'
  | 'check_out'
  | 'check_in_time'
  | 'check_out_time'
  | 'total_price'
  | 'prepayment'
  | 'payment_status'
  | 'source'

export interface VoiceBookingParsed {
  property_id: string | null
  /** Properties the phrase could refer to when it is ambiguous ("инжу"). */
  property_candidates: string[]
  guest_name: string | null
  guest_phone: string | null
  check_in: string | null
  check_out: string | null
  check_in_time: string | null
  check_out_time: string | null
  total_price: number | null
  price_per_night: number | null
  prepayment: number | null
  payment_status: PaymentStatus | null
  source: string | null
  comment: string | null
  /** Fields the user should double-check before saving. */
  uncertain: VoiceField[]
  /** A phone number found in earlier bookings of a guest with this name. */
  known_guest_phone: string | null
}

/** Raw model output — same shape as the JSON schema below. */
export interface ModelBookingOutput {
  property_id: string | null
  property_candidates: string[]
  guest_name: string | null
  guest_phone: string | null
  check_in: string | null
  check_out: string | null
  nights: number | null
  check_in_time: string | null
  check_out_time: string | null
  total_price: number | null
  price_per_night: number | null
  prepayment: number | null
  payment_status: PaymentStatus | null
  source: string | null
  comment: string | null
  uncertain: VoiceField[]
}

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] })

const VOICE_FIELDS: VoiceField[] = [
  'property_id', 'guest_name', 'guest_phone', 'check_in', 'check_out', 'check_in_time',
  'check_out_time', 'total_price', 'prepayment', 'payment_status', 'source',
]

export const BOOKING_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'property_id', 'property_candidates', 'guest_name', 'guest_phone', 'check_in', 'check_out', 'nights',
    'check_in_time', 'check_out_time', 'total_price', 'price_per_night', 'prepayment', 'payment_status',
    'source', 'comment', 'uncertain',
  ],
  properties: {
    property_id: nullable({ type: 'string', description: 'id квартиры из списка или null' }),
    property_candidates: { type: 'array', items: { type: 'string' }, description: 'id квартир, если название неоднозначно' },
    guest_name: nullable({ type: 'string' }),
    guest_phone: nullable({ type: 'string', description: 'только цифры и +' }),
    check_in: nullable({ type: 'string', format: 'date' }),
    check_out: nullable({ type: 'string', format: 'date' }),
    nights: nullable({ type: 'integer', description: 'если названо число ночей вместо даты выезда' }),
    check_in_time: nullable({ type: 'string', description: 'HH:MM' }),
    check_out_time: nullable({ type: 'string', description: 'HH:MM' }),
    total_price: nullable({ type: 'integer', description: 'сумма за весь период, тенге' }),
    price_per_night: nullable({ type: 'integer', description: 'цена за ночь, тенге' }),
    prepayment: nullable({ type: 'integer', description: 'предоплата / внесено, тенге' }),
    payment_status: nullable({ type: 'string', enum: ['waiting', 'partial', 'paid'] }),
    source: nullable({ type: 'string' }),
    comment: nullable({ type: 'string' }),
    uncertain: { type: 'array', items: { type: 'string', enum: VOICE_FIELDS } },
  },
} as const

export function buildSystemPrompt(): string {
  return [
    'Ты разбираешь надиктованную по-русски фразу о бронировании посуточной квартиры в Казахстане и возвращаешь JSON по схеме.',
    'Текст получен диктовкой iPhone: в нём бывают ошибки распознавания, числа словами, нет знаков препинания.',
    'Правила:',
    '- Квартиры называют короткими числами (например 12, 24, 89, 1509), обычно первым словом фразы. Число в начале фразы — это квартира; не путай его с датами ("с 12 по 15") и суммами.',
    '- Квартиру выбирай только из переданного списка по названию или голосовым псевдонимам; верни её id. Если подходит несколько, верни property_id = null и перечисли их id в property_candidates. Если ничего не подходит, null.',
    '- Даты возвращай в формате YYYY-MM-DD. Относительные даты ("завтра", "в пятницу", "с 12 по 15") считай от сегодняшней даты; месяц без указания — ближайший будущий, где это число ещё не прошло. Год не называют — бери ближайший будущий.',
    '- "С 12 по 15" означает заезд 12-го и выезд 15-го. Если названо число ночей ("на три ночи"), заполни nights, а check_out можно оставить null.',
    '- Суммы в тенге целым числом: "девять тысяч" = 9000, "девять с половиной" = 9500, "сорок пять" рядом с тысячами = 45000. Различай сумму за весь период (total_price) и цену за ночь (price_per_night: "по десять тысяч", "за сутки").',
    '- Предоплата / "внёс" / "перевёл" / "задаток" → prepayment. Статус оплаты ставь, только если про оплату сказано явно.',
    '- Источник (source) выбирай только из переданного списка источников, иначе null.',
    '- Имя гостя пиши с заглавной буквы, как произнесено. Телефон — только если продиктован.',
    '- Всё остальное, что сказано (количество гостей, просьбы, время), коротко положи в comment.',
    '- В uncertain перечисли поля, в которых ты не уверен: неоднозначная квартира, странная сумма, возможная ошибка распознавания имени или даты.',
    '- Ничего не выдумывай: чего нет во фразе, возвращай null.',
  ].join('\n')
}

export function buildUserPrompt(params: {
  transcript: string
  today: string
  weekday: string
  properties: VoiceProperty[]
  sources: string[]
}): string {
  const propertyLines = params.properties.map(p => {
    const aliases = (p.voice_aliases ?? []).filter(Boolean)
    return `- id=${p.id}; название: ${p.name}${aliases.length ? `; псевдонимы: ${aliases.join(', ')}` : ''}; цена за ночь: ${p.base_price}`
  })
  return [
    `Сегодня: ${params.today} (${params.weekday}).`,
    'Квартиры:',
    ...propertyLines,
    `Источники брони: ${params.sources.join(', ') || 'direct'}`,
    '',
    'Фраза:',
    params.transcript,
  ].join('\n')
}

export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim()
}

const NUMBER_WORD_STEMS = [
  'ноль', 'один', 'одн', 'два', 'две', 'втор', 'три', 'трет', 'четыр', 'четв', 'пят', 'шест', 'сем', 'седьм',
  'восем', 'восьм', 'девят', 'десят', 'сорок', 'девяност', 'сто', 'тысяч',
]

/** "12", "1509", "двадцать четыре", "двенадцатая" — names that also look like dates or sums. */
export function isNumericTerm(term: string): boolean {
  const words = term.split(' ').filter(Boolean)
  return words.length > 0 && words.every(w => /^\d+$/.test(w) || NUMBER_WORD_STEMS.some(stem => w.startsWith(stem)))
}

// Filler a phrase may start with before the flat: "квартира 24 ...", "на 12 ...".
const LEADING_FILLER = new Set(['квартира', 'квартиру', 'кв', 'на', 'в', 'бронь', 'новая', 'это'])

function phraseStart(text: string): string {
  const words = text.split(' ').filter(Boolean)
  let i = 0
  while (i < words.length && i < 2 && LEADING_FILLER.has(words[i])) i++
  return ` ${words.slice(i).join(' ')} `
}

/**
 * Deterministic fallback for when the model returns no property: finds names
 * and aliases spelled out in the phrase. Returns every property whose longest
 * matching term wins, so "инжу 12" beats a bare "инжу". Numeric names only
 * count at the start of the phrase, so "с 12 по 15" is not read as flat 12.
 */
export function matchPropertiesByAlias(transcript: string, properties: VoiceProperty[]): string[] {
  const normalized = normalizeForMatch(transcript)
  const text = ` ${normalized} `
  const start = phraseStart(normalized)
  const found = (term: string) => (isNumericTerm(term) ? start.startsWith(` ${term} `) : text.includes(` ${term} `))
  let best = 0
  let matches: string[] = []
  for (const p of properties) {
    const terms = [p.name, ...(p.voice_aliases ?? [])].map(normalizeForMatch).filter(Boolean)
    const longest = Math.max(0, ...terms.filter(found).map(t => t.length))
    if (longest === 0) continue
    if (longest > best) {
      best = longest
      matches = [p.id]
    } else if (longest === best) {
      matches.push(p.id)
    }
  }
  return matches
}

function toMoney(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return Math.round(value)
}

function toTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

function toPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const digits = value.replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.length === 11 && digits.startsWith('8') ? `+7${digits.slice(1)}` : `+${digits}`
}

function toText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/**
 * Validates the model output against what the app can actually store and
 * fills in the derivable fields. Anything that had to be dropped or guessed
 * is added to `uncertain` so the confirmation screen highlights it.
 */
export function normalizeModelOutput(
  raw: ModelBookingOutput,
  ctx: { transcript: string; properties: VoiceProperty[]; sources: string[]; today: string },
): VoiceBookingParsed {
  const uncertain = new Set<VoiceField>((raw.uncertain ?? []).filter(f => VOICE_FIELDS.includes(f)))
  const propertyIds = new Set(ctx.properties.map(p => p.id))

  let propertyId = raw.property_id && propertyIds.has(raw.property_id) ? raw.property_id : null
  let candidates = (raw.property_candidates ?? []).filter(id => propertyIds.has(id))
  const byAlias = matchPropertiesByAlias(ctx.transcript, ctx.properties)
  if (propertyId && byAlias.length === 1 && byAlias[0] !== propertyId) {
    // The phrase names a flat outright, yet the model chose another one
    // (e.g. read "с 24" as flat 24): trust the phrase, offer the model's pick.
    candidates = [propertyId, ...candidates]
    propertyId = byAlias[0]
    uncertain.add('property_id')
  } else if (!propertyId && candidates.length === 0) {
    if (byAlias.length === 1) {
      propertyId = byAlias[0]
    } else {
      candidates = byAlias
    }
  }
  if (!propertyId && candidates.length === 1) propertyId = candidates[0]
  if (propertyId) candidates = candidates.filter(id => id !== propertyId)
  if (!propertyId || candidates.length > 0) uncertain.add('property_id')

  const checkIn = isIsoDate(raw.check_in) ? raw.check_in : null
  let checkOut = isIsoDate(raw.check_out) ? raw.check_out : null
  if (checkIn && !checkOut && raw.nights && raw.nights > 0 && raw.nights < 366) {
    checkOut = addDaysIso(checkIn, Math.round(raw.nights))
  }
  if (checkIn && checkOut && checkOut <= checkIn) {
    checkOut = null
    uncertain.add('check_out')
  }
  if (checkIn && checkIn < addDaysIso(ctx.today, -1)) uncertain.add('check_in')
  if (!checkIn) uncertain.add('check_in')
  if (!checkOut) uncertain.add('check_out')

  const nights = checkIn && checkOut ? diffDaysIso(checkIn, checkOut) : null
  const pricePerNight = toMoney(raw.price_per_night)
  let total = toMoney(raw.total_price)
  if (total === null && pricePerNight !== null && nights) total = pricePerNight * nights
  if (total === null) uncertain.add('total_price')

  const prepayment = toMoney(raw.prepayment)
  let paymentStatus: PaymentStatus | null = raw.payment_status ?? null
  if (!paymentStatus && prepayment !== null && prepayment > 0) {
    paymentStatus = total !== null && prepayment >= total ? 'paid' : 'partial'
  }

  const source = raw.source && ctx.sources.includes(raw.source) ? raw.source : null

  const guestName = toText(raw.guest_name)
  if (!guestName) uncertain.add('guest_name')

  return {
    property_id: propertyId,
    property_candidates: candidates,
    guest_name: guestName,
    guest_phone: toPhone(raw.guest_phone),
    check_in: checkIn,
    check_out: checkOut,
    check_in_time: toTime(raw.check_in_time),
    check_out_time: toTime(raw.check_out_time),
    total_price: total,
    price_per_night: pricePerNight,
    prepayment,
    payment_status: paymentStatus,
    source,
    comment: toText(raw.comment),
    uncertain: VOICE_FIELDS.filter(f => uncertain.has(f)),
    known_guest_phone: null,
  }
}

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

export function formatDayMonth(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS_GENITIVE[m - 1]}`
}

export function formatRange(checkIn: string, checkOut: string): string {
  return `${formatDayMonth(checkIn)} – ${formatDayMonth(checkOut)}`
}

export function pluralNights(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} ночь`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ночи`
  return `${n} ночей`
}

function formatTenge(value: number): string {
  return `${value.toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ')} ₸`
}

/** Short Russian summary the iOS Shortcut shows (and can read aloud). */
export function buildSummary(
  parsed: VoiceBookingParsed,
  availability: AvailabilityReport,
  properties: VoiceProperty[],
): string {
  const nameOf = (id: string) => properties.find(p => p.id === id)?.name ?? '?'
  const lines: string[] = []

  if (parsed.property_id) {
    lines.push(`🏠 ${nameOf(parsed.property_id)}`)
  } else if (parsed.property_candidates.length > 0) {
    lines.push(`🏠 Какая квартира? ${parsed.property_candidates.map(nameOf).join(' или ')}`)
  } else {
    lines.push('🏠 Квартира не распознана')
  }

  if (parsed.check_in && parsed.check_out) {
    lines.push(`📅 ${formatRange(parsed.check_in, parsed.check_out)} (${pluralNights(diffDaysIso(parsed.check_in, parsed.check_out))})`)
  } else if (parsed.check_in) {
    lines.push(`📅 Заезд ${formatDayMonth(parsed.check_in)}, выезд не распознан`)
  } else {
    lines.push('📅 Даты не распознаны')
  }

  lines.push(`👤 ${parsed.guest_name ?? 'Имя не распознано'}`)
  if (parsed.total_price !== null) {
    const prepay = parsed.prepayment ? `, внесено ${formatTenge(parsed.prepayment)}` : ''
    lines.push(`💰 ${formatTenge(parsed.total_price)}${prepay}`)
  } else {
    lines.push('💰 Сумма не распознана')
  }

  if (availability.status === 'free') {
    lines.push('✅ Свободно')
  } else if (availability.status === 'busy') {
    const who = availability.conflicts
      .map(c => `${c.guest_name ?? 'бронь'} ${formatRange(c.check_in, c.check_out)}`)
      .join('; ')
    lines.push(`⛔ Занято: ${who}`)
    if (availability.alternatives.length > 0) {
      lines.push(`Свободно рядом: ${availability.alternatives.map(a => formatRange(a.check_in, a.check_out)).join(', ')}`)
    }
    if (availability.free_properties.length > 0) {
      lines.push(`Свободны на эти даты: ${availability.free_properties.map(p => p.name).join(', ')}`)
    }
  } else if (availability.free_windows.length > 0) {
    const first = availability.free_windows.slice(0, 3)
      .map(w => formatRange(w.check_in, w.check_out))
      .join(', ')
    lines.push(`Свободные окна: ${first}`)
  } else if (availability.free_properties.length > 0) {
    lines.push(`Свободны на эти даты: ${availability.free_properties.map(p => p.name).join(', ')}`)
  }

  return lines.join('\n')
}
