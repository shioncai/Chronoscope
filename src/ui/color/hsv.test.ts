import { describe, it, expect } from 'vitest'
import { normalizeHex, hexToHsv, hsvToHex } from './hsv'

describe('normalizeHex', () => {
  it('normalizes shorthand, missing hash, and case; rejects junk', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('2980B9')).toBe('#2980b9')
    expect(normalizeHex('#2980b9')).toBe('#2980b9')
    expect(normalizeHex('nope')).toBeNull()
    expect(normalizeHex('#12345')).toBeNull()
  })
})

describe('hexToHsv', () => {
  it('maps primaries and neutrals', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 })
    expect(hexToHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 1 })
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 })
  })
})

describe('round-trip', () => {
  it('hex → hsv → hex is stable for exact colors', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#808080', '#2980b9']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex)
    }
  })
})
