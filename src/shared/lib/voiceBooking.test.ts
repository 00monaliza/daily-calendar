import { describe, expect, it } from 'vitest'
import {
  buildSummary,
  isNumericTerm,
  matchPropertiesByAlias,
  normalizeModelOutput,
  pluralNights,
  type ModelBookingOutput,
  type VoiceProperty,
} from './voiceBooking'
import { buildAvailabilityReport } from './bookingAvailability'

// Same aliases as the seed in migration 007.
const properties: VoiceProperty[] = [
  { id: 'almatau', name: 'Алматау', base_price: 15000, voice_aliases: ['89', 'восемьдесят девять'] },
  { id: 'inju12', name: 'Инжу Арена 12', base_price: 18000, voice_aliases: ['12', 'двенадцать', 'двенадцатая'] },
  { id: 'inju24', name: 'Инжу Арена 24', base_price: 20000, voice_aliases: ['24', 'двадцать четыре', 'двадцать четвёртая'] },
  { id: 'vesna', name: 'Весна 3', base_price: 12000, voice_aliases: ['49', 'сорок девять'] },
  { id: 'k1509', name: '1509', base_price: 14000, voice_aliases: ['1509', 'пятнадцать ноль девять', 'тысяча пятьсот девять'] },
  { id: 'k2006', name: '2006', base_price: 14000, voice_aliases: ['2006', 'двадцать ноль шесть', 'две тысячи шесть'] },
]
const sources = ['direct', 'kaspi', 'avito']
const ctx = { transcript: '', properties, sources, today: '2026-10-19' }

function output(overrides: Partial<ModelBookingOutput>): ModelBookingOutput {
  return {
    property_id: null,
    property_candidates: [],
    guest_name: null,
    guest_phone: null,
    check_in: null,
    check_out: null,
    nights: null,
    check_in_time: null,
    check_out_time: null,
    total_price: null,
    price_per_night: null,
    prepayment: null,
    payment_status: null,
    source: null,
    comment: null,
    uncertain: [],
    ...overrides,
  }
}

describe('isNumericTerm', () => {
  it.each(['12', '1509', 'двадцать четыре', 'двадцать четвертая', 'двенадцатая', 'сорок девять', 'тысяча пятьсот девять'])(
    '%s is numeric',
    term => expect(isNumericTerm(term)).toBe(true),
  )
  it.each(['алматау', 'инжу арена 12', 'весна 3'])('%s is not numeric', term => expect(isNumericTerm(term)).toBe(false))
})

describe('matchPropertiesByAlias', () => {
  it('reads a leading number as the flat', () => {
    expect(matchPropertiesByAlias('24, Айгерим, с 12 по 15 ноября, 45 тысяч', properties)).toEqual(['inju24'])
    expect(matchPropertiesByAlias('89 Олжас на три ночи', properties)).toEqual(['almatau'])
  })

  it('does not read dates or sums in the middle of the phrase as a flat', () => {
    expect(matchPropertiesByAlias('Айгерим с 12 по 24 ноября', properties)).toEqual([])
    expect(matchPropertiesByAlias('Олжас 49 тысяч', properties)).toEqual([])
  })

  it('allows filler words before the number', () => {
    expect(matchPropertiesByAlias('квартира 1509 на две ночи', properties)).toEqual(['k1509'])
    expect(matchPropertiesByAlias('на двадцать четыре Айгерим', properties)).toEqual(['inju24'])
  })

  it('prefers the longest number', () => {
    expect(matchPropertiesByAlias('двадцать четыре Айгерим', properties)).toEqual(['inju24'])
    expect(matchPropertiesByAlias('две тысячи шесть, Олжас', properties)).toEqual(['k2006'])
  })

  it('still matches full names anywhere, ignoring case and punctuation', () => {
    expect(matchPropertiesByAlias('бронь в «Алматау», три ночи', properties)).toEqual(['almatau'])
  })

  it('matches numbers as whole words only', () => {
    expect(matchPropertiesByAlias('15090 тенге', properties)).toEqual([])
  })
})

describe('normalizeModelOutput', () => {
  it('keeps a clean extraction and marks nothing uncertain', () => {
    const parsed = normalizeModelOutput(
      output({
        property_id: 'inju12',
        guest_name: 'Айгерим',
        check_in: '2026-11-12',
        check_out: '2026-11-15',
        total_price: 45000,
        prepayment: 10000,
        source: 'kaspi',
      }),
      ctx,
    )
    expect(parsed).toMatchObject({
      property_id: 'inju12',
      guest_name: 'Айгерим',
      total_price: 45000,
      prepayment: 10000,
      payment_status: 'partial',
      source: 'kaspi',
      uncertain: [],
    })
  })

  it('derives check-out from nights and total from nightly price', () => {
    const parsed = normalizeModelOutput(
      output({ property_id: 'vesna', guest_name: 'Олжас', check_in: '2026-11-01', nights: 3, price_per_night: 12000 }),
      ctx,
    )
    expect(parsed.check_out).toBe('2026-11-04')
    expect(parsed.total_price).toBe(36000)
  })

  it('trusts a leading flat number over a model that read a date as the flat', () => {
    const parsed = normalizeModelOutput(output({ property_id: 'inju24', guest_name: 'Айгерим' }), {
      ...ctx,
      transcript: '12 Айгерим с 24 по 26 ноября',
    })
    expect(parsed.property_id).toBe('inju12')
    expect(parsed.property_candidates).toEqual(['inju24'])
    expect(parsed.uncertain).toContain('property_id')
  })

  it('drops ids and sources the model invented', () => {
    const parsed = normalizeModelOutput(output({ property_id: 'made-up', source: 'instagram' }), {
      ...ctx,
      transcript: '89 на выходные',
    })
    expect(parsed.property_id).toBe('almatau')
    expect(parsed.source).toBeNull()
  })

  it('keeps ambiguous properties as candidates', () => {
    const parsed = normalizeModelOutput(output({ property_candidates: ['inju12', 'inju24'] }), ctx)
    expect(parsed.property_id).toBeNull()
    expect(parsed.property_candidates).toEqual(['inju12', 'inju24'])
    expect(parsed.uncertain).toContain('property_id')
  })

  it('rejects a check-out before check-in and flags missing fields', () => {
    const parsed = normalizeModelOutput(output({ check_in: '2026-11-15', check_out: '2026-11-12' }), ctx)
    expect(parsed.check_out).toBeNull()
    expect(parsed.uncertain).toEqual(expect.arrayContaining(['check_out', 'guest_name', 'total_price']))
  })

  it('normalizes Kazakh phone numbers and times', () => {
    const parsed = normalizeModelOutput(output({ guest_phone: '8 777 123 45 67', check_in_time: '9.30' }), ctx)
    expect(parsed.guest_phone).toBe('+77771234567')
    expect(parsed.check_in_time).toBe('09:30')
  })
})

describe('buildSummary', () => {
  it('mentions conflicts and alternatives', () => {
    const parsed = normalizeModelOutput(
      output({ property_id: 'inju12', guest_name: 'Айгерим', check_in: '2026-11-11', check_out: '2026-11-12', total_price: 18000 }),
      ctx,
    )
    const availability = buildAvailabilityReport({
      bookings: [{ id: 'b1', property_id: 'inju12', check_in: '2026-11-10', check_out: '2026-11-13', guest_name: 'Олжас' }],
      properties,
      propertyId: parsed.property_id,
      checkIn: parsed.check_in,
      checkOut: parsed.check_out,
      today: '2026-10-19',
    })
    const summary = buildSummary(parsed, availability, properties)
    expect(summary).toContain('Инжу Арена 12')
    expect(summary).toContain('11 ноября – 12 ноября (1 ночь)')
    expect(summary).toContain('⛔ Занято: Олжас 10 ноября – 13 ноября')
    expect(summary).toContain('Свободно рядом')
  })
})

describe('pluralNights', () => {
  it.each([[1, '1 ночь'], [3, '3 ночи'], [5, '5 ночей'], [11, '11 ночей'], [21, '21 ночь'], [22, '22 ночи']])(
    '%i → %s',
    (n, expected) => expect(pluralNights(n)).toBe(expected),
  )
})
