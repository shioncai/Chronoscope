import { describe, it, expect } from 'vitest'
import { parsePrefs, prefsOf, savePrefs, loadPrefs, PREFS_STORAGE_KEY } from './prefs'
import { initialAppState } from './types'

describe('prefs', () => {
  it('keeps the valid fields and drops the rest', () => {
    expect(parsePrefs(JSON.stringify({ view: 'timeline', sort: { key: 'title', dir: 'desc' }, timelineAxis: 'log', timelineLanes: true, timelineScale: 1.5 })))
      .toEqual({ view: 'timeline', sort: { key: 'title', dir: 'desc' }, timelineAxis: 'log', timelineLanes: true, timelineScale: 1.5 })
    expect(parsePrefs(JSON.stringify({ view: 'gallery', sort: { key: 'x', dir: 'up' }, timelineScale: 9 }))).toEqual({})
    expect(parsePrefs('not json')).toEqual({})
    expect(parsePrefs(null)).toEqual({})
  })

  it('round-trips through storage', () => {
    const map = new Map<string, string>()
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
    const s = { ...initialAppState(2026, 'day'), view: 'timeline' as const, timelineAxis: 'log' as const }
    savePrefs(storage, prefsOf(s))
    expect(map.has(PREFS_STORAGE_KEY)).toBe(true)
    expect(loadPrefs(storage)).toEqual(prefsOf(s))
  })

  it('survives a storage that throws', () => {
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(loadPrefs(broken)).toEqual({})
    expect(() => savePrefs(broken, prefsOf(initialAppState(2026, 'day')))).not.toThrow()
  })
})
