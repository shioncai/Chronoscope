import { describe, it, expect } from 'vitest'
import { PRECISION_ORDER, PRECISION_YEARS } from './precision'

describe('precision', () => {
  it('orders fine to coarse', () => {
    expect(PRECISION_ORDER[0]).toBe('second')
    expect(PRECISION_ORDER[PRECISION_ORDER.length - 1]).toBe('Ga')
  })
  it('maps units to years', () => {
    expect(PRECISION_YEARS.year).toBe(1)
    expect(PRECISION_YEARS.decade).toBe(10)
    expect(PRECISION_YEARS.Ma).toBe(1_000_000)
    expect(PRECISION_YEARS.day).toBeCloseTo(1 / 365.2425, 6)
  })
})
