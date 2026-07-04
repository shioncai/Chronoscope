import { describe, it, expect } from 'vitest'
import { fromYear, fromAgo, withFuzz, PRESENT_EPOCH } from './timepoint'
import { fuzzRangeOf } from './span'

describe('fuzzRangeOf', () => {
  it('returns a zero-width range when there is no fuzz', () => {
    expect(fuzzRangeOf(fromYear(1990, 'year'))).toEqual({ earliest: 1990, latest: 1990 })
    const at = PRESENT_EPOCH - 3.8e9
    expect(fuzzRangeOf(fromAgo(3.8e9, 'Ga'))).toEqual({ earliest: at, latest: at })
  })
  it('applies a symmetric explicit range', () => {
    const tp = withFuzz(fromYear(1990, 'year'), { before: 5, after: 5 })
    expect(fuzzRangeOf(tp)).toEqual({ earliest: 1985, latest: 1995 })
  })
  it('applies an asymmetric explicit range', () => {
    const tp = withFuzz(fromYear(1990, 'year'), { before: 2, after: 8 })
    expect(fuzzRangeOf(tp)).toEqual({ earliest: 1988, latest: 1998 })
  })
  it('clamps a degenerate negative range to zero width', () => {
    const corrupt = { ...fromYear(1990, 'year'), fuzz: { before: -5, after: -5 } }
    expect(fuzzRangeOf(corrupt)).toEqual({ earliest: 1990, latest: 1990 })
  })
})
