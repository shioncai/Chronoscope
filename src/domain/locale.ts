// The set of UI languages the app supports. Defined in the domain layer (the
// lowest layer that needs it — formatTimePoint takes a locale) as a pure,
// zero-dependency value type. Adding a language = extend the union AND LOCALES.
export type Locale = 'zh' | 'en'

export const LOCALES: readonly Locale[] = ['zh', 'en']

// The international fallback when the user's browser language is unsupported.
export const FALLBACK_LOCALE: Locale = 'en'

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}
