import { type Locale, LOCALES, FALLBACK_LOCALE, isLocale } from '../domain/locale'

export const LOCALE_STORAGE_KEY = 'chronoscope.locale'

export { LOCALES, FALLBACK_LOCALE }

// stored value wins; else the first browser language whose primary subtag is
// supported; else the English fallback.
export function resolveInitialLocale(stored: string | null, browserLangs: readonly string[]): Locale {
  if (isLocale(stored)) return stored
  for (const lang of browserLangs) {
    const primary = lang.toLowerCase().split('-')[0]
    if (isLocale(primary)) return primary
  }
  return FALLBACK_LOCALE
}

export function loadStoredLocale(storage: Pick<Storage, 'getItem'>): string | null {
  return storage.getItem(LOCALE_STORAGE_KEY)
}

export function persistLocale(storage: Pick<Storage, 'setItem'>, locale: Locale): void {
  storage.setItem(LOCALE_STORAGE_KEY, locale)
}

export function applyLocale(root: { setAttribute(name: string, value: string): void }, locale: Locale): void {
  root.setAttribute('lang', locale)
}
