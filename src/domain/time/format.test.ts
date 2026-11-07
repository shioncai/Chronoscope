import { describe, it, expect } from 'vitest'
import { fromYear, fromCivil, fromAgo } from './timepoint'
import { formatTimePoint, formatTimePointShort, formatAgeLabel, formatDuration, formatRelative } from './format'

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
    expect(formatTimePoint(fromAgo(3.8e9, 'Ga'))).toBe('约38亿年前')
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
    // read 约10亿年后, not 约-…年前.
    expect(formatTimePoint(fromAgo(-1e9, 'Ga'))).toBe('约10亿年后')
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

describe('formatTimePoint (English)', () => {
  it('formats civil, year, decade, and BCE', () => {
    expect(formatTimePoint(fromCivil({ y: 2026, mo: 6, d: 21 }, 'day'), 'en')).toBe('2026-06-21')
    expect(formatTimePoint(fromCivil({ y: 2026, mo: 6, d: 21, h: 15, mi: 30 }, 'minute'), 'en')).toBe('2026-06-21 15:30')
    expect(formatTimePoint(fromYear(1969, 'year'), 'en')).toBe('1969')
    expect(formatTimePoint(fromYear(-2999, 'year'), 'en')).toBe('3000 BCE')
    expect(formatTimePoint(fromYear(1990, 'decade'), 'en')).toBe('1990s')
  })
  it('formats centuries with English ordinals', () => {
    expect(formatTimePoint(fromYear(2001, 'century'), 'en')).toBe('21st century')
    expect(formatTimePoint(fromYear(-2999, 'century'), 'en')).toBe('30th century BCE')
  })
  it('formats deep time with independent English thresholds', () => {
    expect(formatTimePoint(fromAgo(4.6e9, 'Ga'), 'en')).toBe('~4.6 billion years ago')
    expect(formatTimePoint(fromAgo(4.6e6, 'Ma'), 'en')).toBe('~4.6 million years ago')
    expect(formatTimePoint(fromAgo(4.6e5, 'ka'), 'en')).toBe('~460,000 years ago')
    expect(formatTimePoint(fromAgo(3000, 'ka'), 'en')).toBe('~3,000 years ago')
    expect(formatTimePoint(fromAgo(0, 'Ga'), 'en')).toBe('now')
    expect(formatTimePoint(fromAgo(-1e9, 'Ga'), 'en')).toBe('~1 billion years from now')
  })
})

describe('formatTimePointShort', () => {
  // The sidebar tree gives an event row ~160px at depth. "~445 million years ago"
  // alone needs most of that, so the title was squeezed to nothing. The compact
  // form is shorter than the prose in EITHER language, and — unlike the prose —
  // it is the same width in both.
  it('collapses deep time to its own unit', () => {
    expect(formatTimePointShort(fromAgo(445e6, 'Ma'), 'en')).toBe('~445 Ma')
    expect(formatTimePointShort(fromAgo(445e6, 'Ma'), 'zh')).toBe('~445 Ma')
    expect(formatTimePointShort(fromAgo(4.6e9, 'Ga'), 'en')).toBe('~4.6 Ga')
    expect(formatTimePointShort(fromAgo(12e3, 'ka'), 'en')).toBe('~12 ka')
  })

  it('marks the future, which would otherwise read as the past', () => {
    expect(formatTimePointShort(fromAgo(-5e9, 'Ga'), 'en')).toBe('in ~5 Ga')
    expect(formatTimePointShort(fromAgo(-5e9, 'Ga'), 'zh')).toBe('~5 Ga后')
  })

  it('leaves everything already short exactly as it reads elsewhere', () => {
    expect(formatTimePointShort(fromYear(1969, 'year'), 'en')).toBe('1969')
    expect(formatTimePointShort(fromCivil({ y: 2026, mo: 6, d: 21 }, 'day'), 'en')).toBe('2026-06-21')
    expect(formatTimePointShort(fromYear(1969, 'year'), 'zh')).toBe('1969年')
    expect(formatTimePointShort(fromAgo(0, 'Ga'), 'en')).toBe('now')
    // under a millennium the prose is short already, and "~800 yr" would be
    // ambiguous with the year 800
    expect(formatTimePointShort(fromAgo(800, 'ka'), 'en')).toBe('~800 years ago')
  })
})

describe('formatAgeLabel', () => {
  it('speaks each magnitude in its own unit, tersely', () => {
    expect(formatAgeLabel(66e6, 'en')).toBe('66 Ma')
    expect(formatAgeLabel(4.6e9, 'en')).toBe('4.6 Ga')
    expect(formatAgeLabel(1e4, 'en')).toBe('10 ka')
    expect(formatAgeLabel(250, 'en')).toBe('250 yr ago')
    expect(formatAgeLabel(1000, 'en')).toBe('1,000 yr ago')
    expect(formatAgeLabel(1 / 365.2425, 'en')).toBe('1 d ago')
    expect(formatAgeLabel(66e6, 'zh')).toBe('6600万年前')
    expect(formatAgeLabel(4.6e9, 'zh')).toBe('46亿年前')
    expect(formatAgeLabel(250, 'zh')).toBe('250年前')
  })
  it('marks the future and the present', () => {
    expect(formatAgeLabel(-10, 'en')).toBe('in 10 yr')
    expect(formatAgeLabel(-5e9, 'en')).toBe('in 5 Ga')
    expect(formatAgeLabel(-10, 'zh')).toBe('10年后')
    expect(formatAgeLabel(0, 'en')).toBe('now')
    expect(formatAgeLabel(0, 'zh')).toBe('现在')
  })
})

describe('formatDuration / formatRelative', () => {
  it('names a span in the unit that fits it', () => {
    expect(formatDuration(312, 'en')).toBe('312 years')
    expect(formatDuration(1, 'en')).toBe('1 year')
    expect(formatDuration(2.5 / 365.2425, 'en')).toBe('2.5 days')
    expect(formatDuration(3.2e8, 'zh')).toBe('3.2亿年')
    expect(formatDuration(5 / 12, 'zh')).toBe('5个月')
    expect(formatDuration(0, 'en')).toBe('under a minute')
  })
  it('reads an age as before/after now', () => {
    expect(formatRelative(1953, 'en')).toBe('1,953 years ago')
    expect(formatRelative(-3 / 365.2425, 'zh')).toBe('3天后')
    expect(formatRelative(66e6, 'en')).toBe('66 million years ago')
  })
})
