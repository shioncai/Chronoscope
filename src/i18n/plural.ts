import type { Locale } from '../domain/locale'

export type PluralCategory = 'one' | 'other'

// The only plural rule needed for zh+en. Isolated so a future language with
// richer rules changes exactly this function.
export function plural(locale: Locale, n: number): PluralCategory {
  if (locale === 'en') return n === 1 ? 'one' : 'other'
  return 'other'
}
