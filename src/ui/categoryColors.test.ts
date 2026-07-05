import { describe, it, expect } from 'vitest'
import {
  CATEGORY_PRESETS,
  CATEGORY_PRESET_GRID,
  CATEGORY_PRESET_BASE,
  nextPresetColor,
  loadCustomColors,
  persistCustomColors,
  addToPalette,
  removeFromPalette,
  replaceInPalette,
} from './categoryColors'

function memoryStorage(): Storage {
  const store: Record<string, string> = {}
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
    key: () => null,
    length: 0,
  } as unknown as Storage
}

describe('preset grid', () => {
  it('is 5 rows of 9 hues, base is the mid row, presets is the flattened grid', () => {
    expect(CATEGORY_PRESET_GRID).toHaveLength(5)
    for (const row of CATEGORY_PRESET_GRID) expect(row).toHaveLength(9)
    expect(CATEGORY_PRESET_BASE).toEqual(CATEGORY_PRESET_GRID[2])
    expect(CATEGORY_PRESETS).toHaveLength(45)
    for (const base of CATEGORY_PRESET_BASE) expect(CATEGORY_PRESETS).toContain(base)
  })
})

describe('nextPresetColor', () => {
  it('cycles through the distinct base hues', () => {
    expect(nextPresetColor(0)).toBe(CATEGORY_PRESET_BASE[0])
    expect(nextPresetColor(1)).toBe(CATEGORY_PRESET_BASE[1])
    expect(nextPresetColor(CATEGORY_PRESET_BASE.length)).toBe(CATEGORY_PRESET_BASE[0])
  })
})

describe('removeFromPalette', () => {
  it('removes case-insensitively and leaves others', () => {
    expect(removeFromPalette(['#abcdef', '#123456'], '#ABCDEF')).toEqual(['#123456'])
    expect(removeFromPalette(['#123456'], '#999999')).toEqual(['#123456'])
  })
})

describe('replaceInPalette', () => {
  it('replaces in place (lowercased) and dedupes the result', () => {
    expect(replaceInPalette(['#111111', '#222222'], '#111111', '#ABABAB')).toEqual(['#ababab', '#222222'])
    expect(replaceInPalette(['#111111', '#222222'], '#111111', '#222222')).toEqual(['#222222'])
  })
})

describe('addToPalette', () => {
  it('prepends, lowercases, dedupes, and caps', () => {
    expect(addToPalette([], '#ABCDEF')).toEqual(['#abcdef'])
    expect(addToPalette(['#abcdef'], '#ABCDEF')).toEqual(['#abcdef'])
    expect(addToPalette(['#111111'], '#222222')).toEqual(['#222222', '#111111'])
    const full = Array.from({ length: 12 }, (_, i) => `#0000${String(i).padStart(2, '0')}`)
    const after = addToPalette(full, '#ffffff')
    expect(after.length).toBe(12)
    expect(after[0]).toBe('#ffffff')
  })
})

describe('custom color persistence', () => {
  it('round-trips and tolerates missing/garbage values', () => {
    const s = memoryStorage()
    expect(loadCustomColors(s)).toEqual([])
    persistCustomColors(s, ['#abcdef', '#123456'])
    expect(loadCustomColors(s)).toEqual(['#abcdef', '#123456'])
    s.setItem('chronoscope.customColors', 'not json')
    expect(loadCustomColors(s)).toEqual([])
  })
})
