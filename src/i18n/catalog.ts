import type { Locale } from '../domain/locale'
import { en as commonEn, zh as commonZh } from './messages/common'
import { en as sidebarEn, zh as sidebarZh } from './messages/sidebar'
import { en as dialogsEn, zh as dialogsZh } from './messages/dialogs'

// Merge every namespace. `en` is the shape source of truth; `zh` is structurally
// required to match it (Record<MessageKey, string>), so a missing key is a
// compile error. Later tasks add `...fooEn` / `...fooZh` here.
export const en = { ...commonEn, ...sidebarEn, ...dialogsEn } as const

export type MessageKey = keyof typeof en

export const zh: Record<MessageKey, string> = { ...commonZh, ...sidebarZh, ...dialogsZh }

export const CATALOG: Record<Locale, Record<MessageKey, string>> = { en, zh }
