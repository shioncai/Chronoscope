import { describe, it, expect } from 'vitest'
import { plural } from './plural'

describe('plural', () => {
  it('English distinguishes one from other', () => {
    expect(plural('en', 1)).toBe('one')
    expect(plural('en', 0)).toBe('other')
    expect(plural('en', 2)).toBe('other')
  })
  it('Chinese is always other', () => {
    expect(plural('zh', 1)).toBe('other')
    expect(plural('zh', 5)).toBe('other')
  })
})
