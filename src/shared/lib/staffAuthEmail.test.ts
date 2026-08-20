import { describe, expect, it } from 'vitest'
import { buildStaffSyntheticEmail, normalizeStaffLogin } from './staffAuthEmail'

describe('normalizeStaffLogin', () => {
  it('strips phone number formatting down to digits', () => {
    expect(normalizeStaffLogin('+7 707 123 45 67')).toBe('77071234567')
  })

  it('lowercases and strips punctuation from a username-style login', () => {
    expect(normalizeStaffLogin('  Rizat.K ')).toBe('rizatk')
  })

  it('throws on an empty string', () => {
    expect(() => normalizeStaffLogin('')).toThrow()
  })

  it('throws on whitespace-only input', () => {
    expect(() => normalizeStaffLogin('   ')).toThrow()
  })

  it('throws on input with no letters or digits', () => {
    expect(() => normalizeStaffLogin('...--')).toThrow()
  })
})

describe('buildStaffSyntheticEmail', () => {
  it('builds a deterministic synthetic email from a phone login', () => {
    expect(buildStaffSyntheticEmail('+7 707 123 45 67')).toBe('77071234567@staff.pogostim.kz.internal')
  })

  it('builds a deterministic synthetic email from a username login', () => {
    expect(buildStaffSyntheticEmail('Rizat.K')).toBe('rizatk@staff.pogostim.kz.internal')
  })

  it('is stable across different raw formatting of the same login', () => {
    expect(buildStaffSyntheticEmail('+7 707 123 45 67')).toBe(buildStaffSyntheticEmail('77071234567'))
  })
})
