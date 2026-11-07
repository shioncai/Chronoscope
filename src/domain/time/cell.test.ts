import { describe, it, expect } from 'vitest'
import { parseTimeCell, formatTimeCell } from './cell'
import { fromAgo, fromCivil, fromYear, withFuzz, type TimePoint } from './timepoint'

const parse = (s: string) => {
  const r = parseTimeCell(s)
  if (!r.ok) throw new Error(`failed to parse ${s}`)
  return r.value
}

describe('parseTimeCell', () => {
  it('reads calendar dates at every precision', () => {
    expect(parse('1969')).toEqual(fromYear(1969, 'year'))
    expect(parse('1969-07')).toEqual(fromCivil({ y: 1969, mo: 7 }, 'month'))
    expect(parse('1969-07-20')).toEqual(fromCivil({ y: 1969, mo: 7, d: 20 }, 'day'))
    expect(parse('1969-07-20 20')).toEqual(fromCivil({ y: 1969, mo: 7, d: 20, h: 20 }, 'hour'))
    expect(parse('1969-07-20T20:17')).toEqual(fromCivil({ y: 1969, mo: 7, d: 20, h: 20, mi: 17 }, 'minute'))
    expect(parse('1969/07/20 20:17:40')).toEqual(fromCivil({ y: 1969, mo: 7, d: 20, h: 20, mi: 17, s: 40 }, 'second'))
  })

  it('reads every way of writing BCE', () => {
    const bce500 = fromYear(-499, 'year')
    expect(parse('500 BCE')).toEqual(bce500)
    expect(parse('500 bc')).toEqual(bce500)
    expect(parse('公元前500年')).toEqual(bce500)
    expect(parse('-0499')).toEqual(bce500)
    expect(parse('44-03-15 BCE')).toEqual(fromCivil({ y: -43, mo: 3, d: 15 }, 'day'))
  })

  it('reads coarse precisions and deep time', () => {
    expect(parse('1990s')).toEqual(fromYear(1990, 'decade'))
    expect(parse('1900 [century]')).toEqual(fromYear(1900, 'century'))
    expect(parse('66 Ma')).toEqual(fromAgo(66e6, 'Ma'))
    expect(parse('4.6 Ga ago')).toEqual(fromAgo(4.6e9, 'Ga'))
    expect(parse('12 ka')).toEqual(fromAgo(12e3, 'ka'))
    expect(parse('46亿年前')).toEqual(fromAgo(4.6e9, 'Ga'))
    expect(parse('2026年3月15日')).toEqual(fromCivil({ y: 2026, mo: 3, d: 15 }, 'day'))
  })

  it('reads an uncertainty range', () => {
    expect(parse('4.6 Ga ± 0.2 Ga')).toEqual(withFuzz(fromAgo(4.6e9, 'Ga'), { before: 2e8, after: 2e8 }))
    expect(parse('1066 ± 5')).toEqual(withFuzz(fromYear(1066, 'year'), { before: 5, after: 5 }))
    expect(parse('1066 -1/+3 y')).toEqual(withFuzz(fromYear(1066, 'year'), { before: 1, after: 3 }))
  })

  it('treats a blank cell as no time and rejects nonsense', () => {
    expect(parseTimeCell('   ')).toEqual({ ok: true, value: undefined })
    expect(parseTimeCell('soon').ok).toBe(false)
    expect(parseTimeCell('2026-13').ok).toBe(false)
    expect(parseTimeCell('2026-02-30').ok).toBe(false)
    expect(parseTimeCell('0 BCE').ok).toBe(false)
    expect(parseTimeCell('1990-03 [decade]').ok).toBe(false)
  })
})

describe('formatTimeCell', () => {
  const samples: TimePoint[] = [
    fromYear(1969, 'year'),
    fromYear(-499, 'year'),
    fromCivil({ y: 2026, mo: 3, d: 15, h: 14, mi: 5 }, 'minute'),
    fromCivil({ y: 2026, mo: 3, d: 15, h: 14, mi: 5, s: 9 }, 'second'),
    fromCivil({ y: 2026, mo: 3, d: 15, h: 14 }, 'hour'),
    fromCivil({ y: -43, mo: 3, d: 15 }, 'day'),
    fromCivil({ y: 1969, mo: 7 }, 'month'),
    fromYear(1990, 'decade'),
    fromYear(-999, 'millennium'),
    fromAgo(66e6, 'Ma'),
    fromAgo(4.6e9, 'Ga'),
    withFuzz(fromAgo(4.54e9, 'Ga'), { before: 5e7, after: 5e7 }),
    withFuzz(fromYear(1066, 'year'), { before: 1, after: 3 }),
    withFuzz(fromCivil({ y: 2026, mo: 3, d: 15 }, 'day'), { before: 2 / 365.2425, after: 2 / 365.2425 }),
  ]

  it('writes text that parses back to the same point', () => {
    for (const tp of samples) {
      const back = parse(formatTimeCell(tp))!
      expect(back.precision).toBe(tp.precision)
      if ('ago' in tp) expect((back as typeof tp).ago).toBeCloseTo(tp.ago, 0)
      else expect((back as typeof tp).year).toBeCloseTo(tp.year, 9)
      expect(back.fuzz?.before ?? 0).toBeCloseTo(tp.fuzz?.before ?? 0, 6)
      expect(back.fuzz?.after ?? 0).toBeCloseTo(tp.fuzz?.after ?? 0, 6)
    }
  })

  it('reads like a person would write it', () => {
    expect(formatTimeCell(fromYear(-499, 'year'))).toBe('500 BCE')
    expect(formatTimeCell(fromAgo(66e6, 'Ma'))).toBe('66 Ma')
    expect(formatTimeCell(withFuzz(fromAgo(4.54e9, 'Ga'), { before: 5e7, after: 5e7 }))).toBe('4.54 Ga ± 50 Ma')
    expect(formatTimeCell(fromYear(1900, 'century'))).toBe('1900 [century]')
    expect(formatTimeCell(undefined)).toBe('')
  })
})
