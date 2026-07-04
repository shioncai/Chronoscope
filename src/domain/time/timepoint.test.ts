import { describe, it, expect } from 'vitest'
import { fromYear, fromCivil, fromAgo, instantOf, compareTimePoints, withFuzz, PRESENT_EPOCH } from './timepoint'

describe('timepoint', () => {
  it('builds from a bare year', () => {
    const tp = fromYear(-2999, 'year')
    expect(tp.year).toBe(-2999)
    expect(tp.civil).toBeUndefined()
    expect(instantOf(tp)).toBe(-2999)
  })
  it('builds from civil and stores both', () => {
    const tp = fromCivil({ y: 2026, mo: 6, d: 21 }, 'day')
    expect(tp.civil).toEqual({ y: 2026, mo: 6, d: 21 })
    expect(instantOf(tp)).toBeGreaterThan(2026.4)
  })
  it('orders across scales', () => {
    const big = fromAgo(3.8e9, 'Ga')
    const recent = fromCivil({ y: 2026, mo: 6, d: 21 }, 'day')
    expect(compareTimePoints(big, recent)).toBeLessThan(0)
  })
  it('places a relative point at PRESENT_EPOCH minus its ago offset', () => {
    expect(instantOf(fromAgo(538_800_000, 'Ma'))).toBe(PRESENT_EPOCH - 538_800_000)
  })
  it('gives two equal-ago points the identical instant (no nowYear drift)', () => {
    expect(instantOf(fromAgo(538_800_000, 'Ma'))).toBe(instantOf(fromAgo(538_800_000, 'Ma')))
  })
})

describe('withFuzz', () => {
  it('attaches a symmetric range', () => {
    expect(withFuzz(fromYear(1969, 'year'), { before: 5, after: 5 }).fuzz).toEqual({ before: 5, after: 5 })
  })
  it('keeps an asymmetric range', () => {
    expect(withFuzz(fromYear(1969, 'year'), { before: 2, after: 8 }).fuzz).toEqual({ before: 2, after: 8 })
  })
  it('omits fuzz when the range is zero or undefined', () => {
    expect(withFuzz(fromYear(1969, 'year'), { before: 0, after: 0 }).fuzz).toBeUndefined()
    expect(withFuzz(fromYear(1969, 'year'), undefined).fuzz).toBeUndefined()
  })
  it('clears an existing range when set back to zero', () => {
    const had = withFuzz(fromYear(1969, 'year'), { before: 5, after: 5 })
    expect(withFuzz(had, { before: 0, after: 0 }).fuzz).toBeUndefined()
  })
  it('clamps negatives to no-fuzz', () => {
    expect(withFuzz(fromYear(1969, 'year'), { before: -3, after: -1 }).fuzz).toBeUndefined()
  })
})
