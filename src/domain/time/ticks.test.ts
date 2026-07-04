import { describe, it, expect } from 'vitest'
import { chooseTickPrecision, generateTicks } from './ticks'
import { instantOf, type AbsoluteTime } from './timepoint'
import { decimalFromCivil } from './decimal'

describe('chooseTickPrecision', () => {
  it('picks a unit giving a readable number of ticks', () => {
    expect(chooseTickPrecision(100)).toBe('decade')   // 100yr / 10 = 10 ticks
    expect(chooseTickPrecision(5)).toBe('year')       // 5yr / 1 = 5 ticks
    expect(chooseTickPrecision(5e9)).toBe('Ga')       // huge range
  })
})

describe('generateTicks', () => {
  it('produces aligned ticks within the view', () => {
    const ticks = generateTicks({ min: 1995, max: 2025 })
    expect(ticks.length).toBeGreaterThanOrEqual(3)
    expect(ticks.length).toBeLessThanOrEqual(12)
    expect(instantOf(ticks[0])).toBeGreaterThanOrEqual(1995)
    expect(instantOf(ticks[ticks.length - 1])).toBeLessThanOrEqual(2025)
    for (const t of ticks) expect(t.precision).toBe('decade')
  })
  it('steps month-aligned ticks with civil dates for a sub-year range', () => {
    const view = { min: decimalFromCivil({ y: 2026, mo: 1 }), max: decimalFromCivil({ y: 2026, mo: 7 }) }
    const ticks = generateTicks(view)
    expect(ticks.length).toBeGreaterThanOrEqual(4)
    for (const t of ticks) {
      expect(t.precision).toBe('month')
      const c = (t as AbsoluteTime).civil
      expect(c).toBeDefined()
      expect(Number.isInteger(c!.mo)).toBe(true)
    }
  })
  it('steps day-aligned ticks for a multi-day range', () => {
    const view = { min: decimalFromCivil({ y: 2026, mo: 3, d: 10 }), max: decimalFromCivil({ y: 2026, mo: 3, d: 18 }) }
    const ticks = generateTicks(view)
    expect(ticks.length).toBeGreaterThanOrEqual(5)
    for (const t of ticks) {
      expect(t.precision).toBe('day')
      expect((t as AbsoluteTime).civil?.d).toBeGreaterThanOrEqual(1)
    }
  })
})
