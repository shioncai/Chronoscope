import { describe, it, expect } from 'vitest'
import {
  initialView,
  zoomView,
  panView,
  clampView,
  lensFromView,
  viewFromLens,
  viewFromLensCenter,
  panViewByLensDrag,
  clampScroll,
  MIN_RANGE_YEARS,
} from './view'

describe('clampScroll', () => {
  it('clamps to [0, contentHeight - viewHeight]', () => {
    expect(clampScroll(-10, 500, 300)).toBe(0)
    expect(clampScroll(999, 500, 300)).toBe(200)
    expect(clampScroll(120, 500, 300)).toBe(120)
  })
  it('returns 0 when content fits the view', () => {
    expect(clampScroll(50, 200, 300)).toBe(0)
  })
})

describe('timeline view math', () => {
  it('initialView fits instants with padding', () => {
    const v = initialView([1900, 2000], 2026)
    expect(v.min).toBeLessThan(1900)
    expect(v.max).toBeGreaterThan(2000)
    expect(v.min).toBeCloseTo(1895, 0) // 100 range, 5% pad = 5
    expect(v.max).toBeCloseTo(2005, 0)
  })
  it('initialView falls back when there are no instants', () => {
    expect(initialView([], 2026)).toEqual({ min: 1926, max: 2036 })
  })
  it('zoomView keeps the anchor year fixed and shrinks the range', () => {
    const v = zoomView({ min: 0, max: 100 }, 0.5, 0.5)
    expect(v.max - v.min).toBeCloseTo(50, 6)
    expect((v.min + v.max) / 2).toBeCloseTo(50, 6) // center anchor unchanged
  })
  it('zoomView refuses to shrink below MIN_RANGE_YEARS', () => {
    const v = zoomView({ min: 0, max: 1 }, 0.5, 0.0001)
    expect(v.max - v.min).toBeCloseTo(MIN_RANGE_YEARS, 9)
  })
  it('panView shifts by a fraction of the range', () => {
    expect(panView({ min: 0, max: 100 }, 0.1)).toEqual({ min: 10, max: 110 })
  })
  it('clampView translates into range, preserving width (no zoom change at edges)', () => {
    const left = clampView({ min: -50, max: 50 }, 0, 1000) // width 100, past left bound
    expect(left.min).toBeCloseTo(0, 6)
    expect(left.max - left.min).toBeCloseTo(100, 6) // width preserved, not truncated
    const right = clampView({ min: 980, max: 1080 }, 0, 1000) // past right bound
    expect(right.max).toBeCloseTo(1000, 6)
    expect(right.max - right.min).toBeCloseTo(100, 6)
  })
  it('clampView caps the window to the whole range', () => {
    const v = clampView({ min: -100, max: 2000 }, 0, 1000)
    expect(v.min).toBeCloseTo(0, 6)
    expect(v.max).toBeCloseTo(1000, 6)
  })
  it('lensFromView and viewFromLens round-trip on the linear overview', () => {
    const overview = { min: 1000, max: 3000 }
    const view = { min: 1500, max: 2000 }
    const lens = lensFromView(view, overview)
    expect(lens.f0).toBeCloseTo(0.25, 6) // (1500-1000)/2000
    expect(lens.f1).toBeCloseTo(0.5, 6) // (2000-1000)/2000
    const back = viewFromLens(lens, overview)
    expect(back.min).toBeCloseTo(1500, 6)
    expect(back.max).toBeCloseTo(2000, 6)
  })
  it('lens width is constant regardless of view position (linear overview)', () => {
    const overview = { min: 0, max: 1000 }
    const a = lensFromView({ min: 100, max: 200 }, overview)
    const b = lensFromView({ min: 700, max: 800 }, overview)
    expect(a.f1 - a.f0).toBeCloseTo(b.f1 - b.f0, 9) // same zoom → same width anywhere
  })
  it('viewFromLensCenter pans to the lens centre WITHOUT changing the range (zoom)', () => {
    const overview = { min: 1000, max: 2000 }
    const view = { min: 1200, max: 1400 } // width 200
    const a = viewFromLensCenter(view, 0.5, overview) // centre → 1500
    expect(a.max - a.min).toBeCloseTo(200, 6) // range preserved → no zoom change
    expect((a.min + a.max) / 2).toBeCloseTo(1500, 6)
    const b = viewFromLensCenter(view, 0.1, overview)
    expect(b.max - b.min).toBeCloseTo(200, 6) // range preserved at any position
    expect((b.min + b.max) / 2).toBeLessThan((a.min + a.max) / 2) // smaller fraction → older centre
  })
  it('panViewByLensDrag does not jump at delta 0 and keeps the range', () => {
    const overview = { min: 0, max: 1000 }
    const view = { min: 200, max: 400 }
    const same = panViewByLensDrag(view, 0, overview)
    expect(same.min).toBeCloseTo(200, 6) // delta 0 → unchanged (no jump)
    expect(same.max).toBeCloseTo(400, 6)
  })
  it('panViewByLensDrag translates by delta·overviewSpan, keeping zoom', () => {
    const overview = { min: 0, max: 1000 }
    const view = { min: 200, max: 400 }
    const out = panViewByLensDrag(view, 0.1, overview) // 0.1 * 1000 = +100
    expect(out.min).toBeCloseTo(300, 6)
    expect(out.max).toBeCloseTo(500, 6)
    expect(out.max - out.min).toBeCloseTo(200, 6) // zoom preserved
  })
})
