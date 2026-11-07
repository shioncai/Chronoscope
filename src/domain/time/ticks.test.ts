import { describe, it, expect } from 'vitest'
import { generateTicks, niceStep } from './ticks'
import { decimalFromCivil } from './decimal'

const years = (view: { min: number; max: number }, n = 10, locale: 'zh' | 'en' = 'en') =>
  generateTicks(view, n, locale)

describe('niceStep', () => {
  it('rounds up to the 1-2-5 ladder', () => {
    expect(niceStep(0.3)).toBe(1)
    expect(niceStep(3)).toBe(5)
    expect(niceStep(12)).toBe(20)
    expect(niceStep(50)).toBe(50)
    expect(niceStep(51)).toBe(100)
    expect(niceStep(1.2e6)).toBe(2e6)
  })
})

describe('generateTicks', () => {
  it('places round years inside the view', () => {
    const ticks = years({ min: 1995, max: 2025 })
    expect(ticks.map((t) => t.label)).toEqual(['1995', '2000', '2005', '2010', '2015', '2020', '2025'])
  })

  it('never leaves a mid-sized deep-time window without ticks', () => {
    // The old unit ladder jumped millennium → Ma → Ga, so a 15 Ma window got at
    // most one tick and a 500 ka window none at all.
    expect(years({ min: -80e6, max: -65e6 }).length).toBeGreaterThanOrEqual(4)
    expect(years({ min: -500e3, max: 0 }).length).toBeGreaterThanOrEqual(4)
  })

  it('labels deep ticks as round ages before present', () => {
    const ticks = years({ min: 1950 - 80e6, max: 1950 - 60e6 }, 5)
    expect(ticks.map((t) => t.label)).toEqual(['80 Ma', '75 Ma', '70 Ma', '65 Ma', '60 Ma'])
    expect(years({ min: 1950 - 80e6, max: 1950 - 60e6 }, 5, 'zh')[0].label).toBe('8000万年前')
  })

  it('puts BCE ticks on round BCE numbers', () => {
    const labels = years({ min: -3200, max: -900 }, 5).map((t) => t.label)
    expect(labels).toEqual(['3000 BCE', '2500 BCE', '2000 BCE', '1500 BCE', '1000 BCE'])
  })

  it('steps month-aligned ticks for a sub-year range', () => {
    const view = { min: decimalFromCivil({ y: 2026, mo: 1 }), max: decimalFromCivil({ y: 2026, mo: 7 }) }
    expect(years(view).map((t) => t.label)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
    ])
  })

  it('steps day-aligned ticks that restart on the 1st', () => {
    const view = { min: decimalFromCivil({ y: 2026, mo: 1, d: 1 }), max: decimalFromCivil({ y: 2026, mo: 3, d: 1 }) }
    const labels = years(view, 8).map((t) => t.label)
    expect(labels).toEqual(['2026-01-01', '2026-01-11', '2026-01-21', '2026-02-01', '2026-02-11', '2026-02-21', '2026-03-01'])
  })

  it('reaches hours and minutes when zoomed in', () => {
    const view = { min: decimalFromCivil({ y: 2026, mo: 3, d: 15, h: 9 }), max: decimalFromCivil({ y: 2026, mo: 3, d: 15, h: 10 }) }
    const labels = years(view, 5).map((t) => t.label)
    expect(labels[0]).toBe('2026-03-15 09:00')
    expect(labels).toContain('2026-03-15 09:15')
  })

  it('is empty for a degenerate view', () => {
    expect(years({ min: 5, max: 5 })).toEqual([])
  })
})
