import { describe, it, expect } from 'vitest'
import { resolveInitialLocale, persistLocale, loadStoredLocale, applyLocale, LOCALE_STORAGE_KEY } from './locale'

describe('locale', () => {
  it('prefers a valid stored locale over the browser', () => {
    expect(resolveInitialLocale('en', ['zh-CN'])).toBe('en')
    expect(resolveInitialLocale('zh', ['en-US'])).toBe('zh')
  })
  it('matches the first supported browser language by primary subtag', () => {
    expect(resolveInitialLocale(null, ['zh-CN', 'en'])).toBe('zh')
    expect(resolveInitialLocale(null, ['en-GB'])).toBe('en')
  })
  it('falls back to English when nothing matches', () => {
    expect(resolveInitialLocale(null, ['fr', 'de'])).toBe('en')
    expect(resolveInitialLocale('garbage', [])).toBe('en')
  })
  it('persists and loads via the storage key', () => {
    const map = new Map<string, string>()
    const storage = { setItem: (k: string, v: string) => void map.set(k, v), getItem: (k: string) => map.get(k) ?? null }
    persistLocale(storage, 'en')
    expect(map.get(LOCALE_STORAGE_KEY)).toBe('en')
    expect(loadStoredLocale(storage)).toBe('en')
  })
  it('applies the locale as an html lang attribute', () => {
    let attr = ''
    applyLocale({ setAttribute: (_n, v) => void (attr = v) }, 'en')
    expect(attr).toBe('en')
  })
})
