import { describe, it, expect } from 'vitest'
import { fromYear } from '../time'
import { validateEvent } from './validate'

describe('validateEvent', () => {
  it('requires a title', () => {
    const r = validateEvent({ title: '  ', start: fromYear(2000, 'year') })
    expect(r.ok).toBe(false)
    expect(r.errors).toContain('title-required')
  })
  it('requires at least one of start/end', () => {
    const r = validateEvent({ title: '事件' })
    expect(r.ok).toBe(false)
    expect(r.errors).toContain('time-required')
  })
  it('rejects end before start', () => {
    const r = validateEvent({
      title: '事件',
      start: fromYear(2000, 'year'),
      end: fromYear(1990, 'year'),
    })
    expect(r.ok).toBe(false)
    expect(r.errors).toContain('end-before-start')
  })
  it('accepts a valid point event', () => {
    const r = validateEvent({ title: '事件', start: fromYear(2000, 'year') })
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
  })
})
