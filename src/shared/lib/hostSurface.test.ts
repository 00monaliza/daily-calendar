import { describe, expect, it } from 'vitest'
import { isStaffHost, STAFF_HOSTNAME } from './hostSurface'

describe('isStaffHost', () => {
  it('is true for the staff hostname', () => {
    expect(isStaffHost(STAFF_HOSTNAME, false)).toBe(true)
  })

  it('is false for the owner hostname', () => {
    expect(isStaffHost('pogostim.kz', false)).toBe(false)
  })

  it('is false for localhost by default', () => {
    expect(isStaffHost('localhost', false)).toBe(false)
  })

  it('is true when forced, regardless of hostname', () => {
    expect(isStaffHost('localhost', true)).toBe(true)
    expect(isStaffHost('pogostim.kz', true)).toBe(true)
  })
})
