import { describe, it, expect } from 'vitest'
import {
  resolveInitialTheme,
  resolveInitialThemeMode,
  resolveTheme,
  persistTheme,
  loadStoredTheme,
  applyTheme,
  applyThemeColor,
  THEME_COLORS,
  THEME_STORAGE_KEY,
} from './theme'

describe('theme', () => {
  it('prefers a valid stored theme', () => {
    expect(resolveInitialTheme('night', false)).toBe('night')
    expect(resolveInitialTheme('day', true)).toBe('day')
  })
  it('falls back to system preference when nothing valid is stored', () => {
    expect(resolveInitialTheme(null, true)).toBe('night')
    expect(resolveInitialTheme(null, false)).toBe('day')
    expect(resolveInitialTheme('garbage', true)).toBe('night')
  })
  it('reads a stored mode, and treats anything else as following the system', () => {
    expect(resolveInitialThemeMode('system')).toBe('system')
    expect(resolveInitialThemeMode('night')).toBe('night')
    expect(resolveInitialThemeMode(null)).toBe('system')
    expect(resolveInitialThemeMode('garbage')).toBe('system')
  })
  it('resolves the system mode against the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('night')
    expect(resolveTheme('system', false)).toBe('day')
    expect(resolveTheme('day', true)).toBe('day')
  })
  it('persists and loads via the storage key', () => {
    const map = new Map<string, string>()
    const storage = { setItem: (k: string, v: string) => void map.set(k, v), getItem: (k: string) => map.get(k) ?? null }
    persistTheme(storage, 'night')
    expect(map.get(THEME_STORAGE_KEY)).toBe('night')
    expect(loadStoredTheme(storage)).toBe('night')
  })
  it('applies the theme as a data-theme attribute', () => {
    let attr = ''
    applyTheme({ setAttribute: (_n, v) => void (attr = v) }, 'day')
    expect(attr).toBe('day')
  })

  describe('theme-color', () => {
    const fakeMeta = () => {
      const attrs: Record<string, string> = {}
      return { attrs, setAttribute: (n: string, v: string) => void (attrs[n] = v) }
    }

    it('collapses every meta tag onto the active theme, overriding the media split', () => {
      // index.html ships one tag per colour scheme. A night theme on a light
      // system must still darken the address bar, so both tags get the same
      // colour — the media queries stop deciding once JS knows the truth.
      const light = fakeMeta()
      const dark = fakeMeta()
      applyThemeColor([light, dark], 'night')
      expect(light.attrs.content).toBe(THEME_COLORS.night)
      expect(dark.attrs.content).toBe(THEME_COLORS.night)
    })

    it('carries a colour for both themes', () => {
      expect(THEME_COLORS.day).toBe('#f0efec')
      expect(THEME_COLORS.night).toBe('#121211')
    })

    it('survives a document with no theme-color tags', () => {
      expect(() => applyThemeColor([], 'day')).not.toThrow()
    })
  })
})
