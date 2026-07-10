import { type Locale, FALLBACK_LOCALE } from '../domain/locale'
import { CATALOG, type MessageKey } from './catalog'
import { plural } from './plural'

export type MessageParams = Record<string, string | number>

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => (k in params ? String(params[k]) : `{${k}}`))
}

export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const template = CATALOG[locale][key] ?? CATALOG[FALLBACK_LOCALE][key] ?? key
  return interpolate(template, params)
}

// Plural helper: resolves `${base}_one` / `${base}_other` and injects {n}.
export function tn(locale: Locale, base: string, n: number, params?: MessageParams): string {
  const key = `${base}_${plural(locale, n)}` as MessageKey
  return translate(locale, key, { n, ...params })
}
