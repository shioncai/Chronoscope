import { describe, it, expect } from 'vitest'
import { formatTimeRange } from './timeText'
import { fromYear } from '../../domain/time'

const NOW = 2026

describe('formatTimeRange', () => {
  it('joins start and end with an arrow', () => {
    expect(formatTimeRange(fromYear(1300, 'year'), fromYear(1600, 'year'), NOW)).toBe('1300年 → 1600年')
  })
  it('shows the start alone when there is no end', () => {
    expect(formatTimeRange(fromYear(1969, 'year'), undefined, NOW)).toBe('1969年')
  })
  it('shows an open interval when only the end is set', () => {
    expect(formatTimeRange(undefined, fromYear(1600, 'year'), NOW)).toBe('→ 1600年')
  })
  it('falls back to a dash when neither is set', () => {
    expect(formatTimeRange(undefined, undefined, NOW)).toBe('—')
  })
})
