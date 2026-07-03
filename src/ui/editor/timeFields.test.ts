import { describe, it, expect } from 'vitest'
import { fromYear, fromCivil } from '../../domain/time'
import { emptyFields, buildTimePoint, fieldsFromTimePoint, type TimeFields } from './timeFields'

const NOW = 2026

// a civil-mode field set with everything blank
function civil(over: Partial<TimeFields> = {}): TimeFields {
  return { ...emptyFields(), ...over }
}

describe('buildTimePoint — civil mode (auto precision)', () => {
  it('year only → year precision', () => {
    expect(buildTimePoint(civil({ year: '1969' }), NOW)).toEqual(fromYear(1969, 'year'))
  })

  it('公元前 (BCE) maps to astronomical year 1 - V', () => {
    expect(buildTimePoint(civil({ era: 'BCE', year: '3000' }), NOW)).toEqual(fromYear(-2999, 'year'))
  })

  it('year + month → month precision', () => {
    expect(buildTimePoint(civil({ year: '2026', mo: '6' }), NOW)).toEqual(fromCivil({ y: 2026, mo: 6 }, 'month'))
  })

  it('year + month + day → day precision', () => {
    expect(buildTimePoint(civil({ year: '2026', mo: '6', d: '21' }), NOW)).toEqual(
      fromCivil({ y: 2026, mo: 6, d: 21 }, 'day'),
    )
  })

  it('through hour → hour precision', () => {
    expect(buildTimePoint(civil({ year: '2026', mo: '6', d: '21', h: '15' }), NOW)).toEqual(
      fromCivil({ y: 2026, mo: 6, d: 21, h: 15 }, 'hour'),
    )
  })

  it('through minute → minute precision (finest)', () => {
    expect(buildTimePoint(civil({ year: '2026', mo: '6', d: '21', h: '15', mi: '30' }), NOW)).toEqual(
      fromCivil({ y: 2026, mo: 6, d: 21, h: 15, mi: 30 }, 'minute'),
    )
  })

  it('an empty year emits null', () => {
    expect(buildTimePoint(civil({ year: '' }), NOW)).toBeNull()
    expect(buildTimePoint(civil({ year: 'abc' }), NOW)).toBeNull()
  })

  it('stops at the first blank level — an orphaned finer field is ignored', () => {
    // month blank but day filled → precision stays year, day dropped
    expect(buildTimePoint(civil({ year: '2026', mo: '', d: '21' }), NOW)).toEqual(fromYear(2026, 'year'))
  })
})

describe('buildTimePoint — scale mode', () => {
  it('decade (calendar) → fromYear(year, decade)', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'decade', year: '1990' }), NOW)).toEqual(
      fromYear(1990, 'decade'),
    )
  })

  it('century BCE → fromYear(1 - V, century)', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'century', era: 'BCE', year: '753' }), NOW)).toEqual(
      fromYear(-752, 'century'),
    )
  })

  it('Ga (relative) → fromYear(nowYear - N·1e9, Ga)', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'Ga', mag: '3.8' }), NOW)).toEqual(
      fromYear(NOW - 3.8e9, 'Ga'),
    )
  })

  it('Ma (relative) → fromYear(nowYear - N·1e6, Ma)', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'Ma', mag: '66' }), NOW)).toEqual(fromYear(NOW - 66e6, 'Ma'))
  })

  it('ka (relative) → fromYear(nowYear - N·1e3, ka)', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'ka', mag: '5' }), NOW)).toEqual(fromYear(NOW - 5000, 'ka'))
  })

  it('empty magnitude / empty calendar year → null', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'Ga', mag: '' }), NOW)).toBeNull()
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'century', year: '' }), NOW)).toBeNull()
  })
})

describe('fieldsFromTimePoint — round-trips through buildTimePoint', () => {
  const cases = [
    fromYear(1969, 'year'),
    fromYear(-2999, 'year'), // 公元前3000年
    fromCivil({ y: 2026, mo: 6 }, 'month'),
    fromCivil({ y: 2026, mo: 6, d: 21 }, 'day'),
    fromCivil({ y: 2026, mo: 6, d: 21, h: 15 }, 'hour'),
    fromCivil({ y: 2026, mo: 6, d: 21, h: 15, mi: 30 }, 'minute'),
    fromYear(1990, 'decade'),
    fromYear(-752, 'century'), // 公元前8世纪
    fromYear(2000, 'millennium'),
    fromYear(NOW - 3.8e9, 'Ga'),
    fromYear(NOW - 66e6, 'Ma'),
    fromYear(NOW - 5000, 'ka'),
  ]
  for (const tp of cases) {
    it(`${tp.precision} @ ${tp.year} round-trips`, () => {
      expect(buildTimePoint(fieldsFromTimePoint(tp, NOW), NOW)).toEqual(tp)
    })
  }

  it('null → empty civil fields', () => {
    expect(fieldsFromTimePoint(null, NOW)).toEqual(emptyFields())
  })

  it('a legacy second-precision point degrades to minute fields', () => {
    const sec = fromCivil({ y: 2026, mo: 6, d: 21, h: 15, mi: 30, s: 45 }, 'second')
    expect(buildTimePoint(fieldsFromTimePoint(sec, NOW), NOW)).toEqual(
      fromCivil({ y: 2026, mo: 6, d: 21, h: 15, mi: 30 }, 'minute'),
    )
  })
})

describe('fieldsFromTimePoint — relative magnitude survives a moving nowYear', () => {
  // A relative point stores an ABSOLUTE year (nowYear_entry − mag·U). nowYear is
  // recomputed from the wall clock each app load, so re-deriving the "距今"
  // magnitude at a later nowYear leaves fp noise in the low digits
  // (13.787 → 13.787000000000512). The magnitude must read back clean.
  const nowBuild = 2026 + 184 / 365 // midnight Jul 4
  const nowView = 2026 + (184 + 4.5 / 24) / 365 // ~4.5h later, next app load

  it('strips fp noise when nowYear advances between entry and viewing', () => {
    const tp = buildTimePoint(civil({ mode: 'scale', unit: 'Ga', mag: '13.787' }), nowBuild)!
    expect(fieldsFromTimePoint(tp, nowView).mag).toBe('13.787')
  })

  it('preserves a legitimately precise magnitude (no over-rounding)', () => {
    const tp = buildTimePoint(civil({ mode: 'scale', unit: 'Ma', mag: '66.043' }), 2026.4)!
    expect(fieldsFromTimePoint(tp, 2026.4).mag).toBe('66.043')
  })
})
