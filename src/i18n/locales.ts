import { type Locale, LOCALES } from '../domain/locale'

// The language's own name (endonym), shown in the switcher.
export const LOCALE_ENDONYMS: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
}

export const SUPPORTED_LOCALES: readonly { code: Locale; name: string }[] =
  LOCALES.map((code) => ({ code, name: LOCALE_ENDONYMS[code] }))
