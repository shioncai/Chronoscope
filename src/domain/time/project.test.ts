import { describe, it, expect } from 'vitest'
import { unprojectLinear, projectLinear } from './project'

describe('projectLinear', () => {
  it('maps endpoints to 0 and 1', () => {
    const view = { min: 1900, max: 2000 }
    expect(projectLinear(1900, view)).toBe(0)
    expect(projectLinear(2000, view)).toBe(1)
    expect(projectLinear(1950, view)).toBeCloseTo(0.5, 6)
  })
})

describe('inverse projections', () => {
  it('unprojectLinear inverts projectLinear', () => {
    const view = { min: 1900, max: 2000 }
    expect(unprojectLinear(0, view)).toBeCloseTo(1900, 6)
    expect(unprojectLinear(1, view)).toBeCloseTo(2000, 6)
    expect(unprojectLinear(0.5, view)).toBeCloseTo(1950, 6)
    expect(projectLinear(unprojectLinear(0.37, view), view)).toBeCloseTo(0.37, 6)
  })
})
