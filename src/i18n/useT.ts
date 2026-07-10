import { useAppState } from '../state'
import { translate, tn, type MessageParams } from './t'
import type { MessageKey } from './catalog'
import type { Locale } from '../domain/locale'

export function useLocale(): Locale {
  return useAppState().locale
}

export function useT(): (key: MessageKey, params?: MessageParams) => string {
  const locale = useLocale()
  return (key, params) => translate(locale, key, params)
}

export function useTn(): (base: string, n: number, params?: MessageParams) => string {
  const locale = useLocale()
  return (base, n, params) => tn(locale, base, n, params)
}
