import { describe, it, expect } from 'vitest'
import { labelWidth, truncateToWidth, placeLabel, BASE_FONT_PX, LABEL_GAP, type LabelPlacement } from './labels'

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

// helper: the drawn label's [left,right] pixel span, from side + anchor + width
function labelSpan(p: LabelPlacement, fontSizePx: number): [number, number] {
  const w = labelWidth(p.text, fontSizePx)
  return p.side === 'left' ? [p.x - w, p.x] : [p.x, p.x + w]
}

describe('placeLabel', () => {
  it('places a short label to the right by default', () => {
    const p = placeLabel({ coreLeft: 100, coreRight: 110, text: 'ab', fontSizePx: 10, canvasWidth: 1000 })
    expect(p.side).toBe('right')
    expect(p.x).toBe(110 + LABEL_GAP)
    expect(p.occLeft).toBe(100)
    expect(p.occRight).toBeCloseTo(110 + LABEL_GAP + labelWidth('ab', 10), 6)
  })
  it('flips left when the right label would overflow the right edge', () => {
    // glyph near the right edge; long-ish label; left has room
    const p = placeLabel({ coreLeft: 900, coreRight: 905, text: '登月纪念', fontSizePx: 10, canvasWidth: 950 })
    expect(p.side).toBe('left')
    const [l, r] = labelSpan(p, 10)
    expect(l).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(950)
  })
  it('never crosses the LEFT edge for a start-of-axis glyph (truncates instead)', () => {
    const p = placeLabel({ coreLeft: 3, coreRight: 3, text: '一个很长的开头标题', fontSizePx: 10, canvasWidth: 120 })
    const [l, r] = labelSpan(p, 10)
    expect(l).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(120)
  })
  it('never crosses the RIGHT edge for an end-of-axis glyph (truncates instead)', () => {
    const p = placeLabel({ coreLeft: 117, coreRight: 117, text: '一个很长的结尾标题', fontSizePx: 10, canvasWidth: 120 })
    const [l, r] = labelSpan(p, 10)
    expect(l).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(120)
  })
  it('drops the label (side none) when neither side has room for even an ellipsis', () => {
    const p = placeLabel({ coreLeft: 1, coreRight: 119, text: 'anything', fontSizePx: 10, canvasWidth: 120 })
    expect(p.side).toBe('none')
    expect(p.text).toBe('')
    expect(p.occLeft).toBe(1)
    expect(p.occRight).toBe(119)
  })
})
