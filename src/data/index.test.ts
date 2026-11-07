import { describe, it, expect } from 'vitest'
import * as data from '.'

describe('data barrel', () => {
  it('re-exports the public surface', () => {
    expect(typeof data.createClock).toBe('function')
    expect(typeof data.newEvent).toBe('function')
    expect(typeof data.touch).toBe('function')
    expect(typeof data.softDelete).toBe('function')
    expect(typeof data.createMemoryRepository).toBe('function')
    expect(typeof data.openDatabase).toBe('function')
    expect(typeof data.getOrCreateNodeId).toBe('function')
  })
})
