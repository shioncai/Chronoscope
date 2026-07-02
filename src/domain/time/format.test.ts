import { describe, it, expect } from 'vitest'
import { fromYear, fromCivil } from './timepoint'
import { formatTimePoint } from './format'

const NOW = 2026

describe('formatTimePoint', () => {
  it('formats civil precisions', () => {
    expect(formatTimePoint(fromCivil({ y: 2026, mo: 6, d: 21 }, 'day'), NOW)).toBe('2026-06-21')
    expect(formatTimePoint(fromCivil({ y: 2026, mo: 6 }, 'month'), NOW)).toBe('2026-06')
    expect(formatTimePoint(fromCivil({ y: 2026, mo: 6, d: 21, h: 15, mi: 30 }, 'minute'), NOW)).toBe('2026-06-21 15:30')
  })
  it('formats years and BCE', () => {
    expect(formatTimePoint(fromYear(1969, 'year'), NOW)).toBe('1969年')
    expect(formatTimePoint(fromYear(-2999, 'year'), NOW)).toBe('公元前3000年')
    expect(formatTimePoint(fromYear(1990, 'decade'), NOW)).toBe('1990年代')
  })
  it('formats geological precisions relative to now', () => {
    expect(formatTimePoint(fromYear(NOW - 3.8e9, 'Ga'), NOW)).toBe('约38.0亿年前')
    expect(formatTimePoint(fromYear(NOW - 66e6, 'Ma'), NOW)).toBe('约6600万年前')
  })

  it('keeps one decimal for non-integer 万 magnitudes, none for whole ones', () => {
    // 12 ka = 12,000 years → 1.2万, not a lossy "约1万年前"
    expect(formatTimePoint(fromYear(NOW - 12000, 'ka'), NOW)).toBe('约1.2万年前')
    // whole-万 values stay clean (no trailing .0)
    expect(formatTimePoint(fromYear(NOW - 50000, 'ka'), NOW)).toBe('约5万年前')
  })
  it('reads a coarse tick at/near now as 现在, not a tiny "X年前"', () => {
    // At Ga scale a tick lands on year 0; its distance (~2026y) is negligible
    // against the billion-year unit, so it should read 现在 rather than 约2026年前.
    expect(formatTimePoint(fromYear(0, 'Ga'), NOW)).toBe('现在')
    expect(formatTimePoint(fromYear(NOW, 'Ga'), NOW)).toBe('现在')
    expect(formatTimePoint(fromYear(NOW, 'Ma'), NOW)).toBe('现在')
  })
  it('formats a future coarse point as X年后, never a negative 年前', () => {
    // Panning the detail axis past now: a tick a billion years ahead must read
    // 约10.0亿年后, not 约-999997974年前.
    expect(formatTimePoint(fromYear(NOW + 1e9, 'Ga'), NOW)).toBe('约10.0亿年后')
    expect(formatTimePoint(fromYear(NOW + 66e6, 'Ma'), NOW)).toBe('约6600万年后')
  })
  it('does not throw on a fine-precision TimePoint missing civil (degraded data); falls back to the year', () => {
    // A fine precision normally carries `civil`; a malformed point (e.g. from
    // fromYear(2026, 'day')) lacks it. The formatter must stay total, not crash.
    expect(() => formatTimePoint({ year: 2026, precision: 'day' }, NOW)).not.toThrow()
    expect(formatTimePoint({ year: 2026, precision: 'day' }, NOW)).toBe('2026年')
    expect(formatTimePoint({ year: -2999, precision: 'minute' }, NOW)).toBe('公元前3000年')
  })
})
