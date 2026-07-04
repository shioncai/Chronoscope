import { describe, it, expect } from 'vitest'
import { fromYear, fromCivil, fromAgo } from './timepoint'
import { formatTimePoint } from './format'

describe('formatTimePoint', () => {
  it('formats civil precisions', () => {
    expect(formatTimePoint(fromCivil({ y: 2026, mo: 6, d: 21 }, 'day'))).toBe('2026-06-21')
    expect(formatTimePoint(fromCivil({ y: 2026, mo: 6 }, 'month'))).toBe('2026-06')
    expect(formatTimePoint(fromCivil({ y: 2026, mo: 6, d: 21, h: 15, mi: 30 }, 'minute'))).toBe('2026-06-21 15:30')
  })
  it('formats years and BCE', () => {
    expect(formatTimePoint(fromYear(1969, 'year'))).toBe('1969年')
    expect(formatTimePoint(fromYear(-2999, 'year'))).toBe('公元前3000年')
    expect(formatTimePoint(fromYear(1990, 'decade'))).toBe('1990年代')
  })
  it('formats geological precisions from their ago offset', () => {
    expect(formatTimePoint(fromAgo(3.8e9, 'Ga'))).toBe('约38.0亿年前')
    expect(formatTimePoint(fromAgo(66e6, 'Ma'))).toBe('约6600万年前')
  })

  it('keeps one decimal for non-integer 万 magnitudes, none for whole ones', () => {
    // 12 ka = 12,000 years → 1.2万, not a lossy "约1万年前"
    expect(formatTimePoint(fromAgo(12000, 'ka'))).toBe('约1.2万年前')
    // whole-万 values stay clean (no trailing .0)
    expect(formatTimePoint(fromAgo(50000, 'ka'))).toBe('约5万年前')
  })
  it('reads a coarse point at/near now as 现在, not a tiny "X年前"', () => {
    // A near-zero ago at Ga/Ma scale is negligible against the unit → 现在.
    expect(formatTimePoint(fromAgo(0, 'Ga'))).toBe('现在')
    expect(formatTimePoint(fromAgo(0, 'Ma'))).toBe('现在')
  })
  it('formats a future coarse point as X年后, never a negative 年前', () => {
    // Panning the detail axis past now yields a negative ago (future); it must
    // read 约10.0亿年后, not 约-…年前.
    expect(formatTimePoint(fromAgo(-1e9, 'Ga'))).toBe('约10.0亿年后')
    expect(formatTimePoint(fromAgo(-66e6, 'Ma'))).toBe('约6600万年后')
  })
  it('does not throw on a fine-precision TimePoint missing civil (degraded data); falls back to the year', () => {
    // A fine precision normally carries `civil`; a malformed point (e.g. from
    // fromYear(2026, 'day')) lacks it. The formatter must stay total, not crash.
    expect(() => formatTimePoint({ year: 2026, precision: 'day' })).not.toThrow()
    expect(formatTimePoint({ year: 2026, precision: 'day' })).toBe('2026年')
    expect(formatTimePoint({ year: -2999, precision: 'minute' })).toBe('公元前3000年')
  })
})
