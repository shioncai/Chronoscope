import { describe, it, expect } from 'vitest'
import { labelWidth, truncateToWidth, BASE_FONT_PX, LABEL_GAP } from './labels'

describe('labelWidth', () => {
  it('sums ~0.6em per ASCII char at the given font size', () => {
    // 4 ASCII chars * 0.6 * 10px = 24
    expect(labelWidth('abcd', 10)).toBeCloseTo(24, 6)
  })
  it('counts CJK / full-width chars as ~1em', () => {
    // 2 CJK * 1.0 * 10px = 20
    expect(labelWidth('登月', 10)).toBeCloseTo(20, 6)
  })
  it('scales linearly with font size', () => {
    expect(labelWidth('登月', 20)).toBeCloseTo(labelWidth('登月', 10) * 2, 6)
  })
  it('exposes the base font and gap constants', () => {
    expect(BASE_FONT_PX).toBe(11)
    expect(LABEL_GAP).toBe(6)
  })
})

describe('truncateToWidth', () => {
  it('returns text unchanged when it already fits', () => {
    expect(truncateToWidth('abc', 1000, 10)).toBe('abc')
  })
  it('appends an ellipsis and fits within maxPx when too wide', () => {
    const out = truncateToWidth('abcdefghij', 24, 10) // room for ~4 units incl. the ellipsis
    expect(out.endsWith('…')).toBe(true)
    expect(labelWidth(out, 10)).toBeLessThanOrEqual(24)
  })
  it('returns empty string when not even the ellipsis fits', () => {
    expect(truncateToWidth('abc', 2, 10)).toBe('')
  })
})
