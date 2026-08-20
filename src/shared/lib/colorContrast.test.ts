import { describe, expect, it } from 'vitest'
import { contrastTextColor, hexToRgb } from './colorContrast'

describe('hexToRgb', () => {
  it('parses a hex color', () => {
    expect(hexToRgb('#376E6F')).toEqual({ r: 55, g: 110, b: 111 })
  })

  it('falls back to the brand teal for an invalid hex', () => {
    expect(hexToRgb('not-a-color')).toEqual({ r: 55, g: 110, b: 111 })
  })
})

describe('contrastTextColor', () => {
  it('picks white text on a dark background', () => {
    const { r, g, b } = hexToRgb('#1C3334')
    expect(contrastTextColor(r, g, b)).toBe('#ffffff')
  })

  it('picks dark text on a light background', () => {
    const { r, g, b } = hexToRgb('#EEF6F6')
    expect(contrastTextColor(r, g, b)).toBe('#1a1a1a')
  })
})
