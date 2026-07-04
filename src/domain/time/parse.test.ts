import { describe, it, expect } from 'vitest'
import { parseTimeInput } from './parse'

const NOW = 2026

describe('parseTimeInput', () => {
  it('parses ISO-ish datetimes', () => {
    expect(parseTimeInput('2026-06-21 15:30', NOW)).toMatchObject({
      precision: 'minute', civil: { y: 2026, mo: 6, d: 21, h: 15, mi: 30 },
    })
    expect(parseTimeInput('2026-06-21', NOW)).toMatchObject({ precision: 'day' })
    expect(parseTimeInput('2026-06', NOW)).toMatchObject({ precision: 'month' })
    expect(parseTimeInput('2026', NOW)).toMatchObject({ precision: 'year', year: 2026 })
  })
  it('parses BCE and decades', () => {
    expect(parseTimeInput('公元前3000年', NOW)).toMatchObject({ precision: 'year', year: -2999 })
    expect(parseTimeInput('1990年代', NOW)).toMatchObject({ precision: 'decade', year: 1990 })
  })
  it('parses geological "ago" forms into an ago offset, not an absolute year', () => {
    expect(parseTimeInput('约38亿年前', NOW)).toMatchObject({ precision: 'Ga', ago: 3.8e9 })
    expect(parseTimeInput('30万年前', NOW)).toMatchObject({ precision: 'ka', ago: 3e5 }) // 3e5 < 1e6 ⇒ ka
  })
  it('returns null for unrecognized input', () => {
    expect(parseTimeInput('sometime last summer', NOW)).toBeNull()
  })
})
