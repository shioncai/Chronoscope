import { describe, it, expect } from 'vitest'
import * as time from './index'

describe('time barrel', () => {
  it('re-exports the public surface', () => {
    expect(typeof time.fromYear).toBe('function')
    expect(typeof time.fromCivil).toBe('function')
    expect(typeof time.formatTimePoint).toBe('function')
    expect(typeof time.fuzzRangeOf).toBe('function')
    expect(typeof time.projectLinear).toBe('function')
    expect(typeof time.generateTicks).toBe('function')
    expect(typeof time.compareTimePoints).toBe('function')
  })
})
