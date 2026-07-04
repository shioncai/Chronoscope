import { describe, it, expect } from 'vitest'
import { migrateTimePoint, migrateEventTimes } from './migrate'

describe('migrateTimePoint', () => {
  it('converts a legacy absolute-stored Ma point to an ago offset, snapped clean', () => {
    // 寒武纪: year was computed as nowYear - 538.8e6 in an earlier session
    const legacy = { year: -538797973.4962629, precision: 'Ma' as const, fuzz: { before: 6e5, after: 6e5 } }
    expect(migrateTimePoint(legacy, 2026.505466)).toEqual({
      ago: 538800000,
      precision: 'Ma',
      fuzz: { before: 6e5, after: 6e5 },
    })
  })
  it('collapses the two reported records to the SAME ago (fixes the ordering)', () => {
    const cam = migrateTimePoint({ year: -538797973.4962629, precision: 'Ma' as const }, 2026.505466)
    const pha = migrateTimePoint({ year: -538797973.494534, precision: 'Ma' as const }, 2026.505466)
    expect(cam).toEqual(pha)
  })
  it('is idempotent on an already-relative point', () => {
    const rel = { ago: 538800000, precision: 'Ma' as const }
    expect(migrateTimePoint(rel, 2026.5)).toBe(rel)
  })
  it('leaves absolute (non-relative-precision) points untouched', () => {
    const abs = { year: 1969, precision: 'year' as const }
    expect(migrateTimePoint(abs, 2026.5)).toBe(abs)
  })
})

describe('migrateEventTimes', () => {
  it('returns null when nothing changed', () => {
    const e = { start: { year: 1969, precision: 'year' as const } }
    expect(migrateEventTimes(e, 2026.5)).toBeNull()
  })
  it('migrates start and end deep-time points', () => {
    // 寒武纪: 538.8 Ma ago → 486.85 Ma ago
    const e = {
      start: { year: -538797973.4962629, precision: 'Ma' as const },
      end: { year: -486847973.4962629, precision: 'Ma' as const },
    }
    const out = migrateEventTimes(e, 2026.505466)!
    expect(out.start).toEqual({ ago: 538800000, precision: 'Ma' })
    expect(out.end).toEqual({ ago: 486850000, precision: 'Ma' })
  })
})
