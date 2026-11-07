import { describe, it, expect } from 'vitest'
import { linearAxis, logAxis, axisFor } from './axis'

const NOW = 2026.5

describe('linearAxis', () => {
  it('is the identity', () => {
    const a = linearAxis()
    expect(a.toU(1969)).toBe(1969)
    expect(a.fromU(-500)).toBe(-500)
  })
})

describe('logAxis', () => {
  const a = logAxis(NOW)

  it('round-trips years through u', () => {
    for (const year of [NOW, NOW - 1, NOW - 66e6, NOW - 13.8e9, NOW + 100, NOW - 1 / 365]) {
      const back = a.fromU(a.toU(year))
      expect(Math.abs(back - year) / Math.max(1, Math.abs(NOW - year))).toBeLessThan(1e-9)
    }
  })

  it('puts now at 0, the past on the left and the future on the right', () => {
    expect(a.toU(NOW)).toBe(0)
    expect(a.toU(NOW - 10)).toBeLessThan(0)
    expect(a.toU(NOW + 10)).toBeGreaterThan(0)
    expect(a.toU(NOW - 1e9)).toBeLessThan(a.toU(NOW - 1e6))
  })

  it('fits the age of the universe and today into about a dozen units', () => {
    const span = a.toU(NOW) - a.toU(NOW - 13.8e9)
    expect(span).toBeGreaterThan(12)
    expect(span).toBeLessThan(13.5)
  })

  it('labels a wide view with round ages', () => {
    const ticks = a.ticks({ min: a.toU(NOW - 13.8e9), max: a.toU(NOW + 0.01) }, 12, 'en')
    const labels = ticks.map((t) => t.label)
    expect(labels).toContain('1 Ga')
    expect(labels).toContain('1 Ma')
    expect(labels).toContain('now')
    expect(ticks.length).toBeLessThanOrEqual(16)
    // strictly increasing positions
    for (let i = 1; i < ticks.length; i++) expect(ticks[i].u).toBeGreaterThan(ticks[i - 1].u)
  })

  it('switches to calendar ticks when zoomed into a locally straight stretch', () => {
    const v = { min: a.toU(1990), max: a.toU(2000) }
    const labels = a.ticks(v, 6, 'en').map((t) => t.label)
    expect(labels).toEqual(['1990', '1992', '1994', '1996', '1998', '2000'])
  })
})

describe('axisFor', () => {
  it('builds the axis a kind names', () => {
    expect(axisFor('log', NOW).kind).toBe('log')
    expect(axisFor('linear', NOW).kind).toBe('linear')
  })
})
