import { describe, it, expect } from 'vitest'
import { CATALOG } from './catalog'
import { LOCALES } from '../domain/locale'

describe('CATALOG', () => {
  it('has no empty-string values for any locale', () => {
    for (const locale of LOCALES) {
      const messages = CATALOG[locale]
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim().length, `${locale}.${key} must be a non-empty string`).toBeGreaterThan(0)
      }
    }
  })

  it('has identical key sets across all locales', () => {
    const [first, ...rest] = LOCALES
    const firstKeys = Object.keys(CATALOG[first]).sort()
    for (const locale of rest) {
      const keys = Object.keys(CATALOG[locale]).sort()
      expect(keys, `${locale} key set must match ${first}`).toEqual(firstKeys)
    }
  })
})
