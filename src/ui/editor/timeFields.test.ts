import { describe, it, expect } from 'vitest'
import { fromYear, fromCivil, fromAgo, instantOf } from '../../domain/time'
import { emptyFields, buildTimePoint, fieldsFromTimePoint, type TimeFields } from './timeFields'

// a civil-mode field set with everything blank
function civil(over: Partial<TimeFields> = {}): TimeFields {
  return { ...emptyFields(), ...over }
}

describe('buildTimePoint — civil mode (auto precision)', () => {
  it('year only → year precision', () => {
    expect(buildTimePoint(civil({ year: '1969' }))).toEqual(fromYear(1969, 'year'))
  })

  it('公元前 (BCE) maps to astronomical year 1 - V', () => {
    expect(buildTimePoint(civil({ era: 'BCE', year: '3000' }))).toEqual(fromYear(-2999, 'year'))
  })

  it('year + month → month precision', () => {
    expect(buildTimePoint(civil({ year: '2026', mo: '6' }))).toEqual(fromCivil({ y: 2026, mo: 6 }, 'month'))
  })

  it('year + month + day → day precision', () => {
    expect(buildTimePoint(civil({ year: '2026', mo: '6', d: '21' }))).toEqual(
      fromCivil({ y: 2026, mo: 6, d: 21 }, 'day'),
    )
  })

  it('through hour → hour precision', () => {
    expect(buildTimePoint(civil({ year: '2026', mo: '6', d: '21', h: '15' }))).toEqual(
      fromCivil({ y: 2026, mo: 6, d: 21, h: 15 }, 'hour'),
    )
  })

  it('through minute → minute precision (finest)', () => {
    expect(buildTimePoint(civil({ year: '2026', mo: '6', d: '21', h: '15', mi: '30' }))).toEqual(
      fromCivil({ y: 2026, mo: 6, d: 21, h: 15, mi: 30 }, 'minute'),
    )
  })

  it('an empty year emits null', () => {
    expect(buildTimePoint(civil({ year: '' }))).toBeNull()
    expect(buildTimePoint(civil({ year: 'abc' }))).toBeNull()
  })

  it('stops at the first blank level — an orphaned finer field is ignored', () => {
    // month blank but day filled → precision stays year, day dropped
    expect(buildTimePoint(civil({ year: '2026', mo: '', d: '21' }))).toEqual(fromYear(2026, 'year'))
  })
})

describe('buildTimePoint — scale mode', () => {
  it('decade (calendar) → fromYear(year, decade)', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'decade', year: '1990' }))).toEqual(
      fromYear(1990, 'decade'),
    )
  })

  it('century BCE → fromYear(1 - V, century)', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'century', era: 'BCE', year: '753' }))).toEqual(
      fromYear(-752, 'century'),
    )
  })

  it('Ga (relative) → fromAgo(N·1e9, Ga)', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'Ga', mag: '3.8' }))).toEqual(fromAgo(3.8e9, 'Ga'))
  })

  it('Ma (relative) → fromAgo(N·1e6, Ma)', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'Ma', mag: '66' }))).toEqual(fromAgo(66e6, 'Ma'))
  })

  it('ka (relative) → fromAgo(N·1e3, ka)', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'ka', mag: '5' }))).toEqual(fromAgo(5000, 'ka'))
  })

  it('empty magnitude / empty calendar year → null', () => {
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'Ga', mag: '' }))).toBeNull()
    expect(buildTimePoint(civil({ mode: 'scale', unit: 'century', year: '' }))).toBeNull()
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
    fromAgo(3.8e9, 'Ga'),
    fromAgo(66e6, 'Ma'),
    fromAgo(5000, 'ka'),
  ]
  for (const tp of cases) {
    it(`${tp.precision} @ ${instantOf(tp)} round-trips`, () => {
      expect(buildTimePoint(fieldsFromTimePoint(tp))).toEqual(tp)
    })
  }

  it('null → empty civil fields', () => {
    expect(fieldsFromTimePoint(null)).toEqual(emptyFields())
  })

  it('a legacy second-precision point degrades to minute fields', () => {
    const sec = fromCivil({ y: 2026, mo: 6, d: 21, h: 15, mi: 30, s: 45 }, 'second')
    expect(buildTimePoint(fieldsFromTimePoint(sec))).toEqual(
      fromCivil({ y: 2026, mo: 6, d: 21, h: 15, mi: 30 }, 'minute'),
    )
  })
})

describe('fieldsFromTimePoint — relative magnitude reads back exactly', () => {
  // ago is the stored source of truth (no nowYear, no re-derivation), so the
  // 距今 magnitude round-trips clean with no fp noise to round away.
  it('reads back the exact magnitude', () => {
    const tp = buildTimePoint(civil({ mode: 'scale', unit: 'Ga', mag: '13.787' }))!
    expect(fieldsFromTimePoint(tp).mag).toBe('13.787')
  })

  it('preserves a legitimately precise magnitude', () => {
    const tp = buildTimePoint(civil({ mode: 'scale', unit: 'Ma', mag: '66.043' }))!
    expect(fieldsFromTimePoint(tp).mag).toBe('66.043')
  })
})
